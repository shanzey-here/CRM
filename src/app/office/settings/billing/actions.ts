'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import {
  getOrCreateStripeCustomerId,
  createSubscriptionCheckoutSession,
  createBillingPortalSession,
} from '@/modules/subscriptions/server/stripe-billing'

type ActionResult = { url: string } | { error: string }

type Guard =
  | { error: string }
  | { supabase: SupabaseClient<Database>; tenantId: string }

async function requireTenantAdmin(): Promise<Guard> {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    return { error: 'No tenant context' }
  }

  // HARD GUARD: only tenant_admin can manage billing, not dispatcher.
  // Checkout/Portal move real money on the platform's own Stripe account —
  // this must never be enforced by UI-hiding alone.
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Forbidden: only a tenant admin can manage billing' }
  }

  return { supabase, tenantId: tenantId as string }
}

async function getOrigin() {
  const headersList = await headers()
  return headersList.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function createCheckoutSessionAction(priceId: string): Promise<ActionResult> {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return guard

  const { supabase, tenantId } = guard

  if (!priceId || typeof priceId !== 'string') {
    return { error: 'A price must be selected' }
  }

  const customerResult = await getOrCreateStripeCustomerId(supabase, tenantId)
  if ('error' in customerResult) return customerResult

  const origin = await getOrigin()

  try {
    const session = await createSubscriptionCheckoutSession({
      tenantId,
      customerId: customerResult.customerId,
      priceId,
      successUrl: `${origin}/office/settings/billing?checkout=success`,
      cancelUrl: `${origin}/office/settings/billing?checkout=cancelled`,
    })

    if (!session.url) {
      return { error: 'Stripe did not return a checkout URL' }
    }

    return { url: session.url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create checkout session' }
  }
}

export async function createPortalSessionAction(): Promise<ActionResult> {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return guard

  const { supabase, tenantId } = guard

  const customerResult = await getOrCreateStripeCustomerId(supabase, tenantId)
  if ('error' in customerResult) return customerResult

  const origin = await getOrigin()

  try {
    const session = await createBillingPortalSession({
      customerId: customerResult.customerId,
      returnUrl: `${origin}/office/settings/billing`,
    })

    return { url: session.url }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create portal session' }
  }
}
