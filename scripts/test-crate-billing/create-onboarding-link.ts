import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

const ACCOUNT_ID = process.argv[2]

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })
  const link = await stripe.accountLinks.create({
    account: ACCOUNT_ID,
    refresh_url: 'http://127.0.0.1:3000/office/settings/billing?refresh=true',
    return_url: 'http://127.0.0.1:3000/office/settings/billing?done=true',
    type: 'account_onboarding',
  })
  console.log('Onboarding URL:', link.url)
}
main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
