import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

const ACCOUNT_ID = process.argv[2]

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })
  const account = await stripe.accounts.retrieve(ACCOUNT_ID)
  console.log('charges_enabled:', account.charges_enabled)
  console.log('details_submitted:', account.details_submitted)
  console.log('capabilities:', JSON.stringify(account.capabilities))
  console.log('requirements.currently_due:', JSON.stringify(account.requirements?.currently_due))
  console.log('requirements.disabled_reason:', account.requirements?.disabled_reason)
  console.log('individual phone set?', !!(account as any).individual?.phone)
}
main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
