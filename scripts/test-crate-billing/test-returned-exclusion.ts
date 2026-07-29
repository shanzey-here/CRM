import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: contact } = await supabase.from('contacts').select('id').eq('tenant_id', tenantId).eq('first_name', 'CrateBilling').single()

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data: crate } = await supabase
    .from('crates')
    .insert({
      tenant_id: tenantId,
      crate_number: `BILLING-TEST-RETURNED-${Date.now()}`,
      status: 'with_customer',
      contact_id: contact!.id,
      rented_since: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      expected_return_date: yesterday,
    })
    .select()
    .single()
  console.log('Created fresh overdue crate:', crate!.id, 'expected_return_date:', crate!.expected_return_date)

  const { sweepCrateBilling } = await import('../../src/modules/storage/server/billing')
  const { updateCrateStatus } = await import('../../src/modules/storage/server/repository')

  const before = await sweepCrateBilling(supabase as any)
  console.log('Before returning: is this crate in the sweep results?', before.results.some((r) => r.crateId === crate!.id))

  // Real transition through the real function: with_customer -> returned -> in_warehouse
  await updateCrateStatus(supabase as any, tenantId, crate!.id, 'returned')
  await updateCrateStatus(supabase as any, tenantId, crate!.id, 'in_warehouse')

  const { data: afterCrate } = await supabase.from('crates').select('status, contact_id, expected_return_date').eq('id', crate!.id).single()
  console.log('Crate state after returning:', JSON.stringify(afterCrate))

  const after = await sweepCrateBilling(supabase as any)
  console.log('After returning: is this crate in the sweep results (must be false)?', after.results.some((r) => r.crateId === crate!.id))
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
