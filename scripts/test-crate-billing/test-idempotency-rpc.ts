import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: contact } = await supabase.from('contacts').select('id').eq('tenant_id', tenantId).eq('first_name', 'CrateBilling').single()
  const { data: crate } = await supabase.from('crates').select('id').eq('tenant_id', tenantId).ilike('crate_number', 'BILLING-TEST-OVERDUE-%').single()

  const today = new Date().toISOString().slice(0, 10)

  console.log('=== Call 1: create_crate_charge_invoice (fresh period) ===')
  const call1 = await supabase.rpc('create_crate_charge_invoice', {
    p_tenant_id: tenantId,
    p_crate_id: crate!.id,
    p_contact_id: contact!.id,
    p_charge_type: 'overdue_fee',
    p_period_start: '2099-01-01', // a period never used before, to isolate this test
    p_amount: 5,
    p_description: 'Idempotency RPC test',
  })
  console.log('Call 1 result:', JSON.stringify(call1.data), call1.error?.message)

  console.log('\n=== Call 2: SAME tenant/crate/period, immediately after ===')
  const call2 = await supabase.rpc('create_crate_charge_invoice', {
    p_tenant_id: tenantId,
    p_crate_id: crate!.id,
    p_contact_id: contact!.id,
    p_charge_type: 'overdue_fee',
    p_period_start: '2099-01-01',
    p_amount: 5,
    p_description: 'Idempotency RPC test — duplicate attempt',
  })
  console.log('Call 2 result (must be already_charged:true):', JSON.stringify(call2.data), call2.error?.message)

  const { data: rows } = await supabase.from('crate_charges').select('*').eq('crate_id', crate!.id).eq('period_start', '2099-01-01')
  console.log('\nReal crate_charges rows for this period (must be exactly 1, not 2):', rows?.length)
  console.log(JSON.stringify(rows, null, 2))
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
