import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('STRIPE_SECRET_KEY is missing from environment variables')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2025-01-27.acacia', // latest api version
  typescript: true,
})

export type CreateDepositIntentParams = {
  amount: number // in major units (e.g. £100.50 -> 100.50)
  currency?: string
  tenantConnectedAccountId: string
  quoteId: string
  tenantId: string
}

export async function createDepositPaymentIntent({
  amount,
  currency = 'gbp',
  tenantConnectedAccountId,
  quoteId,
  tenantId,
}: CreateDepositIntentParams) {
  // Stripe expects amount in minor units (pence/cents)
  const amountInMinorUnits = Math.round(amount * 100)

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInMinorUnits,
    currency: currency.toLowerCase(),
    // Ensures the deposit goes to the tenant's connected account
    transfer_data: {
      destination: tenantConnectedAccountId,
    },
    on_behalf_of: tenantConnectedAccountId,
    metadata: {
      quote_id: quoteId,
      tenant_id: tenantId,
      type: 'deposit_payment',
    },
  })

  return paymentIntent
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
