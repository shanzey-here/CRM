import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/modules/payments/server/stripe'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { markQuoteAccepted } from '@/modules/quotes/server/repository'
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
          console.error(`Failed to mark quote accepted for intent ${paymentIntent.id}:`, result.error)
          return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
        }
        
        console.log(`Successfully marked quote ${quoteId} as accepted via webhook.`)
      }
    }
  }

  return NextResponse.json({ received: true })
}
