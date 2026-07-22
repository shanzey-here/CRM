import { stripe } from '@/modules/payments/server/stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'

// Platform SaaS Billing (Stripe Billing/Subscriptions) — the tenant pays US.
// Distinct from src/modules/payments/server/stripe.ts, which is Stripe Connect
// (destination charges): the tenant's customers pay the tenant. Both reuse
// the same `stripe` client (same platform account, same STRIPE_SECRET_KEY) —
// the only difference is this module never passes transfer_data/on_behalf_of.

// Resolves (creating + persisting if missing) the tenant's Stripe Customer id.
// Reads via the caller's authenticated client (tenants RLS allows tenant
// members to SELECT their own row); writes via service-role, since tenants
// RLS has no tenant_admin UPDATE policy — only super_admin_all covers writes.
export async function getOrCreateStripeCustomerId(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ customerId: string } | { error: string }> {
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name, stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) {
    return { error: 'Tenant not found' }
  }

  if (tenant.stripe_customer_id) {
    return { customerId: tenant.stripe_customer_id }
  }

  const customer = await stripe.customers.create({
    name: tenant.name,
    metadata: { tenant_id: tenantId },
  })

  const serviceClient = createServiceRoleClient()
  const { error: updateErr } = await serviceClient
    .from('tenants')
    .update({ stripe_customer_id: customer.id })
    .eq('id', tenantId)

  if (updateErr) {
    return { error: `Failed to persist Stripe customer id: ${updateErr.message}` }
  }

  return { customerId: customer.id }
}

export async function createSubscriptionCheckoutSession({
  tenantId,
  customerId,
  priceId,
  successUrl,
  cancelUrl,
}: {
  tenantId: string
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
}) {
  return stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Session-level metadata does NOT propagate to the created Subscription
    // object — subscription_data.metadata is what the webhook actually reads
    // off customer.subscription.* events.
    subscription_data: {
      metadata: { tenant_id: tenantId },
    },
    metadata: { tenant_id: tenantId },
  })
}

export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })
}
