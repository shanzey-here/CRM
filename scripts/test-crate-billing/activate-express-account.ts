import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

const ACCOUNT_ID = process.argv[2]

async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })

  const updated = await stripe.accounts.update(ACCOUNT_ID, {
    business_profile: {
      mcc: '5734',
      url: 'https://gomove-crm-cratebilling-test.com',
    },
    individual: {
      first_name: 'Test',
      last_name: 'Connected',
      email: 'crate-billing-connected-real@example.com',
      phone: '+447700900000',
      dob: { day: 1, month: 1, year: 1990 },
      address: {
        line1: '10 Downing Street',
        city: 'London',
        postal_code: 'SW1A 2AA',
        country: 'GB',
      },
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: '127.0.0.1',
    },
    external_account: {
      object: 'bank_account',
      country: 'GB',
      currency: 'gbp',
      account_holder_name: 'Test Connected',
      account_holder_type: 'individual',
      routing_number: '108800',
      account_number: '00012345',
    } as any,
  })

  console.log('charges_enabled:', updated.charges_enabled)
  console.log('payouts_enabled:', updated.payouts_enabled)
  console.log('capabilities:', JSON.stringify(updated.capabilities))
  console.log('requirements.currently_due:', JSON.stringify(updated.requirements?.currently_due))
  console.log('requirements.disabled_reason:', updated.requirements?.disabled_reason)
}
main().catch((err) => {
  console.error('FATAL:', err.message)
  if (err.raw) console.error(JSON.stringify(err.raw, null, 2))
  process.exit(1)
})
