import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })
  try {
    const account = await stripe.accounts.create({
      type: 'standard',
      email: 'crate-billing-connected-test@example.com',
    })
    console.log('Created connected account:', account.id)
  } catch (err: any) {
    console.log('Error creating connected account:', err.message)
    console.log('Error type:', err.type, 'code:', err.code)
  }
}
main()
