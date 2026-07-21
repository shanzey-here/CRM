import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/modules/payments/server/stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import {
  syncSubscriptionFromStripeObject,
  syncPastDueFromInvoiceFailure,
} from '@/modules/subscriptions/server/webhook-sync'
import Stripe from 'stripe'

// Platform SaaS Billing (Stripe Billing/Subscriptions) webhook — separate
// endpoint and signing secret from /api/webhooks/stripe (which handles
// Stripe Connect events for tenant-customer payments). Kept apart
// deliberately: two different money flows, two different blast radii — a
// resend or incident in one should never be able to touch the other's code
// path. Excluded from the auth proxy the same way the existing route is
// (src/proxy.ts matcher already excludes the whole api/webhooks/* prefix).
export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error('⚠️ Stripe subscriptions webhook signature verification failed.', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const result = await syncSubscriptionFromStripeObject(supabase, {
        eventId: event.id,
        eventType: event.type,
        subscription,
      })

      if (!result.ok) {
        // Genuine failure (DB unreachable, malformed data) — let Stripe retry.
        console.error(`Failed to sync subscription for event ${event.id}:`, result.error)
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      if (!result.processed) {
        console.log(`Event ${event.id} not applied (${result.reason ?? 'no-op'}) — returning 200`)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const result = await syncPastDueFromInvoiceFailure(supabase, {
        eventId: event.id,
        eventType: event.type,
        invoice,
      })

      if (!result.ok) {
        console.error(`Failed to process payment_failed for event ${event.id}:`, result.error)
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      if (!result.processed) {
        console.log(`Event ${event.id} not applied (${result.reason ?? 'no-op'}) — returning 200`)
      }
      break
    }

    case 'checkout.session.completed': {
      // Informational only — the authoritative state sync happens via
      // customer.subscription.created/updated, which fires independently for
      // any subscription-mode Checkout completion. This branch exists so the
      // event is still acknowledged (200) rather than falling through to the
      // "unhandled" log path, and so it's visible in logs for debugging.
      const session = event.data.object as Stripe.Checkout.Session
      console.log(`Checkout session completed: ${session.id} (subscription: ${session.subscription})`)
      break
    }

    default:
      console.log(`Unhandled Stripe subscriptions event type: ${event.type}. Ignoring.`)
  }

  return NextResponse.json({ received: true })
}
