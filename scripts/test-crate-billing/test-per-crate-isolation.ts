import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  // A contact with NO stripe_customer_id/default_payment_method_id at all
  // — a genuinely different failure path than the existing overdue test
  // crate (which has a saved card but fails at the Stripe-destination
  // step). Proves isolation across two distinct, real failure reasons in
  // the same sweep run, not just two crates hitting the identical error.
  const { data: noCardContact } = await supabase
    .from('contacts')
    .insert({ tenant_id: tenantId, first_name: 'NoCard', last_name: 'TestCustomer' })
    .select()
    .single()

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: noCardCrate } = await supabase
    .from('crates')
    .insert({
      tenant_id: tenantId,
      crate_number: `BILLING-TEST-NOCARD-${Date.now()}`,
      status: 'with_customer',
      contact_id: noCardContact!.id,
      rented_since: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      expected_return_date: yesterday,
    })
    .select()
    .single()
  console.log('Created overdue crate with NO payment method on file:', noCardCrate!.id)

  const OVERDUE_CRATE_ID = 'eb77ee36-e1e3-4446-b22d-307522797b4a' // has a real saved card, fails at Stripe destination step

  const { sweepCrateBilling } = await import('../../src/modules/storage/server/billing')
  const result = await sweepCrateBilling(supabase as any)

  const noCardResult = result.results.find((r) => r.crateId === noCardCrate!.id)
  const cardResult = result.results.find((r) => r.crateId === OVERDUE_CRATE_ID)

  console.log('\nNo-payment-method crate result:', JSON.stringify(noCardResult))
  console.log('Saved-card crate result:', JSON.stringify(cardResult))
  console.log(
    '\nBoth processed independently with genuinely different failure reasons?',
    noCardResult && cardResult && !noCardResult.ok && !cardResult.ok && (noCardResult as any).reason !== (cardResult as any).reason
  )
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
