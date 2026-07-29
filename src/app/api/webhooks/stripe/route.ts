import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/modules/payments/server/stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { markQuoteAccepted } from '@/modules/quotes/server/repository'
import { recordInvoicePayment } from '@/modules/invoicing/server/repository'
import { recordCrateChargePayment, markCrateChargeStatus } from '@/modules/storage/server/billing'
import Stripe from 'stripe'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed.`, err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    // We only care about deposit payments that are linked to quotes
    if (paymentIntent.metadata?.type === 'deposit_payment') {
      const quoteId = paymentIntent.metadata.quote_id
      const tenantId = paymentIntent.metadata.tenant_id
      const contactId = paymentIntent.metadata.contact_id

      if (quoteId && tenantId) {
        const supabase = createServiceRoleClient()
        const result = await markQuoteAccepted(supabase, tenantId, quoteId, paymentIntent.id)

        if (!result.success) {
          // Idempotent retry: quote was already accepted (Stripe retrying webhook delivery)
          if ((result as any).alreadyAccepted) {
            console.log(`Quote ${quoteId} already accepted for intent ${paymentIntent.id} (idempotent retry)`)
            return NextResponse.json({ received: true })
          }

          // Genuine failure: should retry
          console.error(`Failed to mark quote accepted for intent ${paymentIntent.id}:`, result.error)
          return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
        }

        // Card-on-file: persist the payment method saved via
        // setup_future_usage so a future crate-billing sweep can charge it
        // off-session. Best-effort — a failure here doesn't roll back the
        // already-accepted quote, it just means automatic crate billing
        // won't have a card on file for this contact yet.
        if (contactId && typeof paymentIntent.payment_method === 'string') {
          const { error: pmError } = await supabase
            .from('contacts')
            .update({ default_payment_method_id: paymentIntent.payment_method })
            .eq('id', contactId)
            .eq('tenant_id', tenantId)
          if (pmError) console.error(`Failed to persist payment method for contact ${contactId}:`, pmError.message)
        }

        console.log(`Successfully marked quote ${quoteId} as accepted via webhook.`)
      }
    } else if (paymentIntent.metadata?.type === 'crate_charge') {
      const crateChargeId = paymentIntent.metadata.crate_charge_id
      const tenantId = paymentIntent.metadata.tenant_id

      if (crateChargeId && tenantId) {
        const supabase = createServiceRoleClient()
        const amount = paymentIntent.amount / 100
        const result = await recordCrateChargePayment(supabase, tenantId, crateChargeId, paymentIntent.id, amount)

        if (!result.success) {
          console.error(`Failed to record crate charge payment for intent ${paymentIntent.id}:`, (result as any).error)
          return NextResponse.json({ error: 'Failed to record crate charge payment' }, { status: 500 })
        }

        if ((result as any).alreadyCharged) {
          console.log(`Crate charge ${crateChargeId} already marked charged for intent ${paymentIntent.id} (idempotent retry)`)
        } else {
          console.log(`Successfully recorded crate charge payment ${crateChargeId}.`)
        }
      }
    } else if (paymentIntent.metadata?.type === 'invoice_payment') {
      const invoiceId = paymentIntent.metadata.invoice_id
      const scheduleId = paymentIntent.metadata.schedule_id
      const tenantId = paymentIntent.metadata.tenant_id

      if (invoiceId && scheduleId && tenantId) {
        const supabase = createServiceRoleClient()
        // amount is in minor units (pence/cents), convert to major units
        const amount = paymentIntent.amount / 100

        const result = await recordInvoicePayment(supabase, tenantId, invoiceId, scheduleId, paymentIntent.id, amount)

        if (!result.success) {
          console.error(`Failed to record invoice payment for intent ${paymentIntent.id}:`, result.error)
          return NextResponse.json({ error: 'Failed to record invoice payment' }, { status: 500 })
        }

        if (result.alreadyPaid) {
          console.log(`Invoice schedule ${scheduleId} already marked paid for intent ${paymentIntent.id} (idempotent retry)`)
        } else {
          console.log(`Successfully recorded invoice payment for schedule ${scheduleId}.`)
        }
      }
    } else {
      // Safe fallback for unhandled metadata types to prevent Stripe retries
      console.log(`Unhandled payment intent metadata type: ${paymentIntent.metadata?.type}. Ignoring.`)
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent

    // Backstop for an async decline the sweep's own synchronous try/catch
    // couldn't see (createOffSessionCrateCharge already handles the
    // synchronous-throw case directly) — same authentication_required vs.
    // generic-decline distinction either way.
    if (paymentIntent.metadata?.type === 'crate_charge') {
      const crateChargeId = paymentIntent.metadata.crate_charge_id
      const tenantId = paymentIntent.metadata.tenant_id

      if (crateChargeId && tenantId) {
        const supabase = createServiceRoleClient()
        const isAuthRequired = paymentIntent.last_payment_error?.code === 'authentication_required'
        const message = paymentIntent.last_payment_error?.message || 'Payment failed'
        await markCrateChargeStatus(supabase, tenantId, crateChargeId, isAuthRequired ? 'requires_action' : 'failed', message)
        console.log(`Marked crate charge ${crateChargeId} as ${isAuthRequired ? 'requires_action' : 'failed'} via webhook.`)
      }
    }
  }

  return NextResponse.json({ received: true })
}
