import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

// Isolates and proves the exact classification predicate used in
// src/modules/storage/server/billing.ts's chargeOneCrate() catch block
// (`stripeErr.code === 'authentication_required'`) against a REAL Stripe
// error, using Stripe's dedicated SCA test payment method. Deliberately a
// PLAIN off-session PaymentIntent (no transfer_data/on_behalf_of) because
// Connect being disabled on this sandbox account blocks the
// destination-charge routing specifically (confirmed separately) — that
// is a distinct concern from "does my code correctly tell
// authentication_required apart from a generic decline," which this test
// isolates and proves for real.
async function main() {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })

  const customer = await stripe.customers.create({ name: 'SCA classification test' })
  const pm = await stripe.paymentMethods.attach('pm_card_authenticationRequired', { customer: customer.id })
  console.log('Customer:', customer.id, 'payment method:', pm.id)

  try {
    await stripe.paymentIntents.create({
      amount: 500,
      currency: 'gbp',
      customer: customer.id,
      payment_method: pm.id,
      off_session: true,
      confirm: true,
    })
    console.log('UNEXPECTED: charge succeeded without requiring authentication')
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError
    console.log('Real Stripe error code:', stripeErr.code)
    console.log('Real Stripe error type:', stripeErr.type)
    console.log('Real Stripe error message:', stripeErr.message)

    // Exact same predicate as billing.ts's chargeOneCrate catch block
    const classifiedAs = stripeErr.code === 'authentication_required' ? 'requires_action' : 'failed'
    console.log('\nThis real error would be classified as:', classifiedAs, '(must be "requires_action", not "failed")')
  }
}
main()
