import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/modules/payments/server/stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { markQuoteAccepted } from '@/modules/quotes/server/repository'
import { recordInvoicePayment } from '@/modules/invoicing/server/repository'
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

        console.log(`Successfully marked quote ${quoteId} as accepted via webhook.`)
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
  }

  return NextResponse.json({ received: true })
}
