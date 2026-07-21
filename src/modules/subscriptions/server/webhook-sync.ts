import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type TenantStatus = Database['public']['Enums']['tenant_status']

// Stripe subscription statuses -> this app's tenant_status enum
// ('trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled' — note
// the DB enum's British double-L spelling, confirmed in 00001_phase0_foundations.sql).
// unpaid/incomplete -> past_due: still owed, not yet a permanent failure.
// incomplete_expired -> cancelled: checkout was abandoned/never completed.
// paused -> suspended: closest semantic match; nothing in Stripe's own
// lifecycle otherwise produces 'suspended' (reserved for manual admin action).
const STRIPE_STATUS_MAP: Record<Stripe.Subscription.Status, TenantStatus> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'cancelled',
  unpaid: 'past_due',
  incomplete: 'past_due',
  incomplete_expired: 'cancelled',
  paused: 'suspended',
}

export function mapStripeStatus(status: Stripe.Subscription.Status): TenantStatus {
  return STRIPE_STATUS_MAP[status]
}

type ResolveResult = { tenantId: string } | { error: string }

// Resolves which tenant a subscription event belongs to. Primary path is
// subscription.metadata.tenant_id (set at Checkout creation via
// subscription_data.metadata, persists across updates). Falls back to
// tenants.stripe_customer_id in case metadata is ever missing (e.g. a
// subscription created directly in the Stripe Dashboard for testing).
// Never trusts anything the client could have supplied — both of these
// come from Stripe's own signed event payload plus our own DB.
export async function resolveTenantId(
  supabase: SupabaseClient<Database>,
  { metadataTenantId, customerId }: { metadataTenantId?: string | null; customerId?: string | null }
): Promise<ResolveResult> {
  if (metadataTenantId) {
    return { tenantId: metadataTenantId }
  }

  if (customerId) {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()

    if (!error && data) {
      return { tenantId: data.id }
    }
  }

  return { error: 'Could not resolve tenant_id from event metadata or customer id' }
}

// Resolves the local saas_prices.id (uuid) from a Stripe price id string.
// Returns null (not an error) if the sync hasn't run for this price yet —
// the caller writes price_id = NULL rather than failing the whole webhook.
export async function resolvePriceId(
  supabase: SupabaseClient<Database>,
  stripePriceId: string | undefined
): Promise<string | null> {
  if (!stripePriceId) return null

  const { data } = await supabase
    .from('saas_prices')
    .select('id')
    .eq('stripe_price_id', stripePriceId)
    .maybeSingle()

  return data?.id ?? null
}

export type SyncOutcome =
  | { ok: true; processed: boolean; reason?: string }
  | { ok: false; error: string }

// Single funnel for every subscription-mutating event. Calls the atomic
// sync_tenant_subscription_from_webhook RPC — see migration 00038 for the
// idempotency guarantee (INSERT into stripe_events is the only guard).
export async function syncSubscriptionFromStripeObject(
  supabase: SupabaseClient<Database>,
  {
    eventId,
    eventType,
    subscription,
  }: { eventId: string; eventType: string; subscription: Stripe.Subscription }
): Promise<SyncOutcome> {
  const metadataTenantId = subscription.metadata?.tenant_id
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id

  const tenantResult = await resolveTenantId(supabase, { metadataTenantId, customerId })
  if ('error' in tenantResult) {
    // Unmappable event: retrying won't fix a data/metadata problem, and
    // 500-looping just hammers Stripe's retry schedule for hours. Log loudly,
    // return success-shaped so the webhook route returns 200.
    console.error(`[stripe-subscriptions webhook] ${tenantResult.error} (event ${eventId}, type ${eventType})`)
    return { ok: true, processed: false, reason: 'unresolvable_tenant' }
  }

  const stripePriceId = subscription.items.data[0]?.price?.id
  const priceId = await resolvePriceId(supabase, stripePriceId)

  // Three distinct cases — spelled out explicitly rather than as a single
  // condensed expression, since getting this backwards silently corrupts
  // price_id on a live tenant row:
  //  1. Stripe has a price AND we have a local match -> write it normally.
  //  2. Stripe has a price but plan-sync hasn't run for it yet -> explicitly
  //     clear price_id to NULL (don't leave a stale/wrong price_id sitting
  //     there) and log a warning so the sync gap is visible.
  //  3. Stripe reports no price at all (shouldn't happen for a real
  //     subscription item, but defensive) -> leave the existing value alone.
  let priceIdParam: string | null = null
  let clearPriceId = false

  if (stripePriceId && priceId) {
    priceIdParam = priceId
    clearPriceId = false
  } else if (stripePriceId && !priceId) {
    console.warn(`[stripe-subscriptions webhook] No local saas_prices match for Stripe price ${stripePriceId} — clearing price_id to NULL (event ${eventId})`)
    priceIdParam = null
    clearPriceId = true
  } else {
    priceIdParam = null
    clearPriceId = false
  }

  const currentPeriodEnd = subscription.items.data[0]?.current_period_end
    ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
    : null

  // The generated RPC arg types mark these optional-with-a-SQL-DEFAULT
  // parameters as `?: T` (i.e. T | undefined), not T | null — omitting the
  // key and explicitly sending null both resolve to the same Postgres
  // DEFAULT NULL, so `?? undefined` here changes nothing at runtime, only
  // satisfies the generated type.
  const { data, error } = await supabase.rpc('sync_tenant_subscription_from_webhook', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_tenant_id: tenantResult.tenantId,
    p_stripe_subscription_id: subscription.id,
    p_status: mapStripeStatus(subscription.status),
    p_price_id: priceIdParam ?? undefined,
    p_clear_price_id: clearPriceId,
    p_current_period_end: currentPeriodEnd ?? undefined,
    p_cancel_at_period_end: subscription.cancel_at_period_end,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const result = data as { processed: boolean; reason?: string }
  return { ok: true, processed: result.processed, reason: result.reason }
}

// invoice.payment_failed: sets status to 'past_due' ONLY. Never overwrites
// price_id/current_period_end/cancel_at_period_end (this event carries no
// authoritative values for those), and never sets 'cancelled' — only
// customer.subscription.deleted does that, once Stripe's own dunning/retry
// flow gives up entirely.
export async function syncPastDueFromInvoiceFailure(
  supabase: SupabaseClient<Database>,
  { eventId, eventType, invoice }: { eventId: string; eventType: string; invoice: Stripe.Invoice }
): Promise<SyncOutcome> {
  // This API version moved the subscription link off the top-level Invoice
  // object (confirmed against node_modules/stripe/cjs/resources/Invoices.d.ts —
  // no `subscription` field there) and into invoice.parent.subscription_details.
  const subscriptionDetails = invoice.parent?.subscription_details
  const subscriptionRef = subscriptionDetails?.subscription
  const subscriptionId =
    typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id

  let tenantId: string | undefined

  if (subscriptionId) {
    const { data } = await supabase
      .from('tenant_subscriptions')
      .select('tenant_id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle()
    tenantId = data?.tenant_id
  }

  if (!tenantId) {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    const tenantResult = await resolveTenantId(supabase, { customerId })
    if ('error' in tenantResult) {
      console.error(`[stripe-subscriptions webhook] ${tenantResult.error} (event ${eventId}, type ${eventType})`)
      return { ok: true, processed: false, reason: 'unresolvable_tenant' }
    }
    tenantId = tenantResult.tenantId
  }

  const { data, error } = await supabase.rpc('sync_tenant_subscription_from_webhook', {
    p_event_id: eventId,
    p_event_type: eventType,
    p_tenant_id: tenantId,
    p_status: 'past_due',
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const result = data as { processed: boolean; reason?: string }
  return { ok: true, processed: result.processed, reason: result.reason }
}
