import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is missing from environment variables')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2025-01-27.acacia', // latest api version
  typescript: true,
})

// Ensures a contact has a Stripe Customer object (created on the PLATFORM
// account, same account the destination charges below run on — this is
// still Stripe Connect, not a second Stripe Billing customer) so a
// payment method can be attached to it and reused for a later off-session
// charge (crate billing). Creates one only if the contact doesn't already
// have one; persists it immediately so a retry never creates a duplicate
// Stripe Customer for the same contact.
export async function getOrCreateStripeCustomer(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string
): Promise<{ stripeCustomerId: string } | { error: string }> {
  const { data: contact, error } = await supabase
    .from('contacts')
    .select('id, stripe_customer_id, first_name, last_name, email')
    .eq('id', contactId)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !contact) return { error: error?.message ?? 'Contact not found' }
  if (contact.stripe_customer_id) return { stripeCustomerId: contact.stripe_customer_id }

  const customer = await stripe.customers.create({
    name: `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}`,
    email: contact.email ?? undefined,
    metadata: { tenant_id: tenantId, contact_id: contactId },
  })

  const { error: updateErr } = await supabase
    .from('contacts')
    .update({ stripe_customer_id: customer.id })
    .eq('id', contactId)
    .eq('tenant_id', tenantId)

  if (updateErr) return { error: updateErr.message }
  return { stripeCustomerId: customer.id }
}

export type CreateDepositIntentParams = {
  amount: number // in major units (e.g. £100.50 -> 100.50)
  currency?: string
  tenantConnectedAccountId: string
  quoteId: string
  tenantId: string
  stripeCustomerId: string
  contactId: string
}

export async function createDepositPaymentIntent({
  amount,
  currency = 'gbp',
  tenantConnectedAccountId,
  quoteId,
  tenantId,
  stripeCustomerId,
  contactId,
}: CreateDepositIntentParams) {
  // Stripe expects amount in minor units (pence/cents)
  const amountInMinorUnits = Math.round(amount * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInMinorUnits,
    currency: currency.toLowerCase(),
    // Attaches this payment to a real Stripe Customer and, on success,
    // saves the resulting payment method for later off-session use — this
    // is the ONLY thing in this codebase that ever saves a card, and it's
    // what makes automatic crate-overdue/lost billing possible at all.
    customer: stripeCustomerId,
    setup_future_usage: 'off_session',
    // Ensures the deposit goes to the tenant's connected account
    transfer_data: {
      destination: tenantConnectedAccountId,
    },
    on_behalf_of: tenantConnectedAccountId,
    metadata: {
      quote_id: quoteId,
      tenant_id: tenantId,
      contact_id: contactId,
      type: 'deposit_payment',
    },
  })

  return paymentIntent
}

export type CreateOffSessionCrateChargeParams = {
  amount: number
  currency?: string
  tenantConnectedAccountId: string
  stripeCustomerId: string
  paymentMethodId: string
  crateChargeId: string
  invoiceId: string
  tenantId: string
  crateId: string
}

// The actual unattended charge — no browser, no customer present. Reuses
// the exact same destination-charge shape as createDepositPaymentIntent
// (transfer_data/on_behalf_of = the tenant's own connected account, same
// platform Stripe client/secret key) — never Stripe Billing. `off_session:
// true` tells Stripe this is an unattended charge (affects how it applies
// risk/SCA rules); `confirm: true` attempts the charge immediately. Throws
// a real Stripe error on decline/SCA-required — the caller (the sweep) is
// responsible for catching it and branching on error.code.
export async function createOffSessionCrateCharge({
  amount,
  currency = 'gbp',
  tenantConnectedAccountId,
  stripeCustomerId,
  paymentMethodId,
  crateChargeId,
  invoiceId,
  tenantId,
  crateId,
}: CreateOffSessionCrateChargeParams) {
  const amountInMinorUnits = Math.round(amount * 100)

  return stripe.paymentIntents.create({
    amount: amountInMinorUnits,
    currency: currency.toLowerCase(),
    customer: stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    transfer_data: {
      destination: tenantConnectedAccountId,
    },
    on_behalf_of: tenantConnectedAccountId,
    metadata: {
      type: 'crate_charge',
      crate_charge_id: crateChargeId,
      invoice_id: invoiceId,
      tenant_id: tenantId,
      crate_id: crateId,
    },
  })
}

export type CreateInvoiceCheckoutSessionParams = {
  amount: number
  currency?: string
  tenantConnectedAccountId: string
  invoiceId: string
  scheduleId: string
  tenantId: string
  successUrl: string
  cancelUrl: string
}

export async function createInvoiceCheckoutSession({
  amount,
  currency = 'gbp',
  tenantConnectedAccountId,
  invoiceId,
  scheduleId,
  tenantId,
  successUrl,
  cancelUrl,
}: CreateInvoiceCheckoutSessionParams) {
  const amountInMinorUnits = Math.round(amount * 100)

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'], // BACS/Asynchronous methods specifically excluded for now
    line_items: [
      {
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: 'Balance Payment',
            description: `Payment for Schedule ${scheduleId.split('-')[0]} on Invoice ${invoiceId.split('-')[0]}`
          },
          unit_amount: amountInMinorUnits,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    payment_intent_data: {
      transfer_data: {
        destination: tenantConnectedAccountId,
      },
      on_behalf_of: tenantConnectedAccountId,
      metadata: {
        type: 'invoice_payment',
        invoice_id: invoiceId,
        schedule_id: scheduleId,
        tenant_id: tenantId,
      },
    },
    client_reference_id: scheduleId,
  })

  return session
}
