import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email: 'crate-billing-connected-real@example.com',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
  })

  console.log('Created account:', account.id)
  console.log(JSON.stringify(account, null, 2))
}
main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
