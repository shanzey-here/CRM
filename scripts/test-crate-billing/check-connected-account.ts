import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })
  console.log('Using platform key prefix:', process.env.STRIPE_SECRET_KEY?.slice(0, 20))

  try {
    const account = await stripe.accounts.retrieve('acct_1TuV7hH3K49zOcgz')
    console.log('Connected account found:', account.id, account.email, account.charges_enabled)
  } catch (err: any) {
    console.log('Error retrieving connected account:', err.message)
  }

  // List all connected accounts under this platform key to see what's really there
  const accounts = await stripe.accounts.list({ limit: 10 })
  console.log(
    'Connected accounts under this platform key:',
    accounts.data.map((a) => ({ id: a.id, email: a.email, charges_enabled: a.charges_enabled }))
  )
}
main()
