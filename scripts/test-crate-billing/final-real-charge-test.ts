import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: contact } = await supabase.from('contacts').select('id, stripe_customer_id, default_payment_method_id').eq('tenant_id', tenantId).eq('first_name', 'CrateBilling').single()
  console.log('Using contact:', contact!.id, 'stripe_customer_id:', contact!.stripe_customer_id, 'payment_method:', contact!.default_payment_method_id)

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: crate } = await supabase
    .from('crates')
    .insert({
      tenant_id: tenantId,
      crate_number: `BILLING-TEST-REAL-CHARGE-${Date.now()}`,
      status: 'with_customer',
      contact_id: contact!.id,
      rented_since: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      expected_return_date: yesterday,
    })
    .select()
    .single()
  console.log('Fresh overdue crate:', crate!.id, crate!.crate_number)

  const { sweepCrateBilling } = await import('../../src/modules/storage/server/billing')
  const result = await sweepCrateBilling(supabase as any)
  const thisResult = result.results.find((r) => r.crateId === crate!.id)
  console.log('\nSweep result for this crate:', JSON.stringify(thisResult, null, 2))

  console.log('\nCRATE_ID=' + crate!.id)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
