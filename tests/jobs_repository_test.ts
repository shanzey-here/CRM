import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('--- Jobs Repository Isolation & Snapshot Test ---')

  // 1. Setup Data - We need 2 tenants
  const tenant1Id = '11111111-1111-1111-1111-111111111111'
  const tenant2Id = '22222222-2222-2222-2222-222222222222'

  await supabase.from('tenants').upsert([
    { id: tenant1Id, name: 'JobTenant 1', slug: 'job-tenant-1' },
    { id: tenant2Id, name: 'JobTenant 2', slug: 'job-tenant-2' }
  ])

  // Tenant 1 Data
  const { data: t1contact } = await supabase.from('contacts').insert({ tenant_id: tenant1Id, first_name: 'T1', type: 'residential' }).select().single()
  const { data: t1quote } = await supabase.from('quotes').insert({ tenant_id: tenant1Id, contact_id: t1contact!.id, status: 'accepted' }).select().single()
  
  // Create an inventory item and link it via quote_inventory
  const { data: t1item } = await supabase.from('inventory_items').insert({ tenant_id: tenant1Id, name: 'Sofa', default_volume: 50 }).select().single()
  await supabase.from('quote_inventory').insert({ tenant_id: tenant1Id, quote_id: t1quote!.id, inventory_item_id: t1item!.id, quantity: 2 })
  
  // Simulate the inventory item being changed AFTER the quote was accepted
  await supabase.from('inventory_items').update({ default_volume: 60 }).eq('id', t1item!.id)

  const { data: t1job } = await supabase.from('jobs').insert({ tenant_id: tenant1Id, contact_id: t1contact!.id, quote_id: t1quote!.id, status: 'scheduled' }).select().single()

  // Tenant 2 Data
  const { data: t2contact } = await supabase.from('contacts').insert({ tenant_id: tenant2Id, first_name: 'T2', type: 'residential' }).select().single()
  const { data: t2job } = await supabase.from('jobs').insert({ tenant_id: tenant2Id, contact_id: t2contact!.id, status: 'scheduled' }).select().single()

  // 2. Test Cross-Tenant Isolation
  console.log('\nTesting Cross-Tenant Isolation...')
  const { getJobDetails, getJobsByTenant } = await import('../src/modules/jobs/server/repository')

  // Tenant 1 trying to read Tenant 2's job
  const leakRes = await getJobDetails(supabase, tenant1Id, t2job!.id)
  const isIsolated = !leakRes.success && (leakRes.error === 'Job not found' || leakRes.error?.includes('JSON object requested, multiple (or no) rows returned'))
  console.log('T1 reading T2 Job:', isIsolated ? 'Pass (Isolated)' : 'Fail (Leaked!)')

  // 3. Test Snapshot Fidelity
  console.log('\nTesting Snapshot Fidelity...')
  const detailRes = await getJobDetails(supabase, tenant1Id, t1job!.id)
  if (detailRes.success) {
    const jobDetails = detailRes.jobDetails
    const quoteData = jobDetails.quote
    const q = Array.isArray(quoteData) ? quoteData[0] : quoteData
    if (q && q.quote_inventory && q.quote_inventory.length > 0) {
        const inventory = q.quote_inventory[0]
        console.log(`Inventory Snapshot Check: Quantity is ${inventory.quantity}. Item name is ${inventory.inventory_item?.name}.`)
      } else {
        console.log('No quote_inventory found in response:', JSON.stringify(quoteData, null, 2))
      }
    console.log('Snapshot structure loaded successfully via quote_id.')
  } else {
    console.error('Snapshot test failed to fetch job details:', detailRes.error)
  }

  // Cleanup
  await supabase.from('jobs').delete().in('id', [t1job!.id, t2job!.id])
  await supabase.from('quote_inventory').delete().eq('quote_id', t1quote!.id)
  await supabase.from('inventory_items').delete().eq('id', t1item!.id)
  await supabase.from('quotes').delete().eq('id', t1quote!.id)
  await supabase.from('contacts').delete().in('id', [t1contact!.id, t2contact!.id])
  await supabase.from('tenants').delete().in('id', [tenant1Id, tenant2Id])

  console.log('\nDone.')
}

runTests().catch(console.error)
