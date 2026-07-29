import { SupabaseClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { Database } from '@/types/database.types'
import { createOffSessionCrateCharge } from '@/modules/payments/server/stripe'

type CrateRow = Database['public']['Tables']['crates']['Row']

export type CrateBillingResult =
  | { crateId: string; ok: true; chargeType: 'overdue_fee' | 'lost_fee'; alreadyCharged: boolean; crateChargeId?: string }
  | { crateId: string; ok: false; chargeType: 'overdue_fee' | 'lost_fee'; reason: string }

// Wraps the create_crate_charge_invoice RPC — the idempotency gate. See
// 00063_phase2_crate_billing.sql: the INSERT into crate_charges is the
// first statement inside the RPC, so a unique_violation there (caught
// inside the RPC itself, not here) means this period/crate was already
// charged or is mid-flight — we get back already_charged:true and must
// never call Stripe for it.
async function createChargeInvoice(
  supabase: SupabaseClient<Database>,
  params: {
    tenantId: string
    crateId: string
    contactId: string
    chargeType: 'overdue_fee' | 'lost_fee'
    periodStart: string
    amount: number
    description: string
  }
): Promise<{ alreadyCharged: boolean; crateChargeId?: string; invoiceId?: string } | { error: string }> {
  const { data, error } = await supabase.rpc('create_crate_charge_invoice', {
    p_tenant_id: params.tenantId,
    p_crate_id: params.crateId,
    p_contact_id: params.contactId,
    p_charge_type: params.chargeType,
    p_period_start: params.periodStart,
    p_amount: params.amount,
    p_description: params.description,
  })

  if (error) return { error: error.message }
  const result = data as { already_charged: boolean; crate_charge_id?: string; invoice_id?: string }
  return { alreadyCharged: result.already_charged, crateChargeId: result.crate_charge_id, invoiceId: result.invoice_id }
}

export async function markCrateChargeStatus(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  crateChargeId: string,
  status: 'failed' | 'requires_action',
  error: string
) {
  await supabase.rpc('mark_crate_charge_failed', {
    p_tenant_id: tenantId,
    p_crate_charge_id: crateChargeId,
    p_status: status,
    p_error: error,
  })
}

export async function recordCrateChargePayment(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  crateChargeId: string,
  stripeIntentId: string,
  amount: number
) {
  const { data, error } = await supabase.rpc('record_crate_charge_payment', {
    p_tenant_id: tenantId,
    p_crate_charge_id: crateChargeId,
    p_stripe_intent_id: stripeIntentId,
    p_amount: amount,
  })
  if (error) return { success: false, error: error.message }
  return { success: true, alreadyCharged: (data as any)?.already_charged === true }
}

async function chargeOneCrate(
  serviceClient: SupabaseClient<Database>,
  crate: CrateRow,
  chargeType: 'overdue_fee' | 'lost_fee',
  amount: number,
  description: string
): Promise<CrateBillingResult> {
  if (!crate.contact_id) {
    return { crateId: crate.id, ok: false, chargeType, reason: 'Crate has no linked contact to bill' }
  }

  const periodStart = new Date().toISOString().slice(0, 10)

  const invoiceResult = await createChargeInvoice(serviceClient, {
    tenantId: crate.tenant_id,
    crateId: crate.id,
    contactId: crate.contact_id,
    chargeType,
    periodStart,
    amount,
    description,
  })

  if ('error' in invoiceResult) {
    return { crateId: crate.id, ok: false, chargeType, reason: invoiceResult.error }
  }
  if (invoiceResult.alreadyCharged) {
    return { crateId: crate.id, ok: true, chargeType, alreadyCharged: true }
  }

  const crateChargeId = invoiceResult.crateChargeId!
  const invoiceId = invoiceResult.invoiceId!

  // Resolve the saved payment method — the card-on-file extension to the
  // deposit checkout is what makes this possible at all.
  const { data: contact } = await serviceClient
    .from('contacts')
    .select('stripe_customer_id, default_payment_method_id')
    .eq('id', crate.contact_id)
    .eq('tenant_id', crate.tenant_id)
    .single()

  if (!contact?.stripe_customer_id || !contact?.default_payment_method_id) {
    await markCrateChargeStatus(serviceClient, crate.tenant_id, crateChargeId, 'failed', 'No payment method on file for this contact')
    return { crateId: crate.id, ok: false, chargeType, reason: 'No payment method on file for this contact' }
  }

  const { data: tenant } = await serviceClient.from('tenants').select('stripe_connected_account_id').eq('id', crate.tenant_id).single()
  if (!tenant?.stripe_connected_account_id) {
    await markCrateChargeStatus(serviceClient, crate.tenant_id, crateChargeId, 'failed', 'Tenant is not configured for payments (no connected Stripe account)')
    return { crateId: crate.id, ok: false, chargeType, reason: 'Tenant not configured for payments' }
  }

  try {
    await createOffSessionCrateCharge({
      amount,
      tenantConnectedAccountId: tenant.stripe_connected_account_id,
      stripeCustomerId: contact.stripe_customer_id,
      paymentMethodId: contact.default_payment_method_id,
      crateChargeId,
      invoiceId,
      tenantId: crate.tenant_id,
      crateId: crate.id,
    })
    // Left 'pending' — the Stripe webhook (payment_intent.succeeded) is the
    // authoritative confirmation, matching how deposit/balance payments
    // already work in this codebase.
    return { crateId: crate.id, ok: true, chargeType, alreadyCharged: false, crateChargeId }
  } catch (err) {
    // authentication_required (SCA/3D Secure) is structurally different
    // from a generic decline — it will NEVER resolve by retrying, since it
    // requires the customer to actively act. Stored distinctly so it's not
    // silently retried by a future sweep the same way a real decline would be.
    const stripeErr = err as Stripe.errors.StripeError
    if (stripeErr.code === 'authentication_required') {
      await markCrateChargeStatus(serviceClient, crate.tenant_id, crateChargeId, 'requires_action', 'Requires customer authentication (3D Secure) — cannot complete automatically')
      return { crateId: crate.id, ok: false, chargeType, reason: 'requires_action: card needs customer authentication' }
    }
    const message = stripeErr.message || 'Unknown Stripe error'
    await markCrateChargeStatus(serviceClient, crate.tenant_id, crateChargeId, 'failed', message)
    return { crateId: crate.id, ok: false, chargeType, reason: message }
  }
}

async function getPricingRates(
  serviceClient: SupabaseClient<Database>,
  tenantIds: string[]
): Promise<Map<string, { crate_overdue_rate_per_day: number; crate_lost_fee: number }>> {
  const map = new Map<string, { crate_overdue_rate_per_day: number; crate_lost_fee: number }>()
  if (tenantIds.length === 0) return map

  const { data } = await serviceClient
    .from('pricing_settings')
    .select('tenant_id, crate_overdue_rate_per_day, crate_lost_fee')
    .in('tenant_id', tenantIds)

  for (const row of data ?? []) {
    map.set(row.tenant_id, { crate_overdue_rate_per_day: row.crate_overdue_rate_per_day, crate_lost_fee: row.crate_lost_fee })
  }
  return map
}

// Per-crate try/catch isolation — a real network call (Stripe) can throw,
// unlike scheduled_posts' isolation-inside-the-callee shape, so isolation
// has to live in this loop directly.
export async function sweepCrateBilling(serviceClient: SupabaseClient<Database>): Promise<{ processed: number; results: CrateBillingResult[] }> {
  const today = new Date().toISOString().slice(0, 10)
  const results: CrateBillingResult[] = []

  // Overdue: with_customer, past expected_return_date.
  const { data: overdueCrates } = await serviceClient
    .from('crates')
    .select('*')
    .eq('status', 'with_customer')
    .lt('expected_return_date', today)

  // Lost: charged at most once ever (crate_charges_lost_fee_once enforces
  // this at the DB level regardless of what this query returns — this
  // query is just an efficiency filter, not the source of the guarantee).
  const { data: lostCrates } = await serviceClient.from('crates').select('*').eq('status', 'lost')

  const allCrates = [...(overdueCrates ?? []), ...(lostCrates ?? [])]
  const tenantIds = [...new Set(allCrates.map((c) => c.tenant_id))]
  const rates = await getPricingRates(serviceClient, tenantIds)

  for (const crate of overdueCrates ?? []) {
    const rate = rates.get(crate.tenant_id)?.crate_overdue_rate_per_day
    if (!rate || rate <= 0) continue // 0/unset = not configured — never invent a price
    try {
      const result = await chargeOneCrate(serviceClient, crate, 'overdue_fee', rate, `Overdue crate rental fee — ${crate.crate_number} (${today})`)
      results.push(result)
    } catch (err) {
      results.push({ crateId: crate.id, ok: false, chargeType: 'overdue_fee', reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  for (const crate of lostCrates ?? []) {
    const rate = rates.get(crate.tenant_id)?.crate_lost_fee
    if (!rate || rate <= 0) continue
    try {
      const result = await chargeOneCrate(serviceClient, crate, 'lost_fee', rate, `Lost crate replacement fee — ${crate.crate_number}`)
      results.push(result)
    } catch (err) {
      results.push({ crateId: crate.id, ok: false, chargeType: 'lost_fee', reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return { processed: results.length, results }
}
