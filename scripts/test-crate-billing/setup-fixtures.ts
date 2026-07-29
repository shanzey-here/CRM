import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-01-27.acacia' as any })

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  // 1. Set real, deliberate crate billing rates
  await supabase.from('pricing_settings').update({ crate_overdue_rate_per_day: 5.0, crate_lost_fee: 50.0 }).eq('tenant_id', tenantId)
  console.log('Set crate_overdue_rate_per_day=5.00, crate_lost_fee=50.00')

  // 2. Create a real Stripe Customer (platform account) + attach a real
  // Stripe test payment method, simulating "this contact already
  // completed a deposit checkout with setup_future_usage" without driving
  // the full browser checkout flow for this specific fixture setup.
  const customer = await stripe.customers.create({ name: 'Crate Billing Test Contact', email: 'crate-billing-test@example.com' })
  const paymentMethod = await stripe.paymentMethods.attach('pm_card_visa', { customer: customer.id })
  console.log('Created Stripe customer:', customer.id, 'payment method:', paymentMethod.id)

  // 3. Create a real test contact with that payment method on file
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      first_name: 'CrateBilling',
      last_name: 'TestCustomer',
      email: 'crate-billing-test@example.com',
      stripe_customer_id: customer.id,
      default_payment_method_id: paymentMethod.id,
    })
    .select()
    .single()
  if (contactErr) throw contactErr
  console.log('Test contact:', contact.id)

  // 4. Create a real overdue test crate (with_customer, expected_return_date yesterday)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: overdueCrate, error: crateErr } = await supabase
    .from('crates')
    .insert({
      tenant_id: tenantId,
      crate_number: `BILLING-TEST-OVERDUE-${Date.now()}`,
      status: 'with_customer',
      contact_id: contact.id,
      rented_since: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expected_return_date: yesterday,
    })
    .select()
    .single()
  if (crateErr) throw crateErr
  console.log('Overdue test crate:', overdueCrate.id, overdueCrate.crate_number, 'expected_return_date:', overdueCrate.expected_return_date)

  // 5. Create a real lost test crate
  const { data: lostCrate, error: lostErr } = await supabase
    .from('crates')
    .insert({
      tenant_id: tenantId,
      crate_number: `BILLING-TEST-LOST-${Date.now()}`,
      status: 'lost',
      contact_id: contact.id,
    })
    .select()
    .single()
  if (lostErr) throw lostErr
  console.log('Lost test crate:', lostCrate.id, lostCrate.crate_number)

  console.log('\nCONTACT_ID=' + contact.id)
  console.log('OVERDUE_CRATE_ID=' + overdueCrate.id)
  console.log('LOST_CRATE_ID=' + lostCrate.id)
  console.log('STRIPE_CUSTOMER_ID=' + customer.id)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
