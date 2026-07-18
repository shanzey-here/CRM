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
