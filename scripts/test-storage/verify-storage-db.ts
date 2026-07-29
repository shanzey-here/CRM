import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createStorageUnit, createCrate, updateCrateStatus } from '../../src/modules/storage/server/repository'

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: adminUser } = await serviceClient.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantAId = adminUser!.tenant_id

  // === Setup: real storage unit + crate for Tenant A, via the real repository functions ===
  const { data: unitA, error: unitErr } = await createStorageUnit(serviceClient, tenantAId, { unitNumber: 'A-101', capacityCubicFeet: 250 })
  if (unitErr) throw unitErr
  console.log('Tenant A storage unit:', unitA!.id, unitA!.unit_number, unitA!.capacity_cubic_feet, 'cu ft')

  const { data: crateA, error: crateErr } = await createCrate(serviceClient, tenantAId, { crateNumber: 'CRATE-0001', storageUnitId: unitA!.id })
  if (crateErr) throw crateErr
  console.log('Tenant A crate:', crateA!.id, crateA!.crate_number, 'status:', crateA!.status)

  // === Test 1: real negative test — invalid crate_status must be rejected by Postgres ===
  console.log('\n=== Test 1: invalid crate_status value ===')
  const badInsert = await serviceClient.from('crates').insert({
    tenant_id: tenantAId,
    crate_number: 'CRATE-BAD-STATUS',
    status: 'in_transit_to_mars' as any,
  })
  console.log('Insert with invalid status — error (must be a real enum rejection):', JSON.stringify(badInsert.error))

  const badUpdate = await serviceClient.from('crates').update({ status: 'not_a_real_status' as any }).eq('id', crateA!.id)
  console.log('Update with invalid status — error (must be a real enum rejection):', JSON.stringify(badUpdate.error))

  // === Test 2: real domain-event emission via updateCrateStatus() ===
  console.log('\n=== Test 2: updateCrateStatus() + domain_events ===')
  const beforeCount = await serviceClient.from('domain_events').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantAId).eq('event_type', 'crate.status_changed')

  const updateResult = await updateCrateStatus(serviceClient, tenantAId, crateA!.id, 'reserved', adminUser!.id)
  console.log('updateCrateStatus() completed. error:', updateResult.error, '| new status:', updateResult.data?.status)

  const { data: events } = await serviceClient
    .from('domain_events')
    .select('*')
    .eq('tenant_id', tenantAId)
    .eq('event_type', 'crate.status_changed')
    .order('occurred_at', { ascending: false })
    .limit(1)
  console.log('Real domain_events row:', JSON.stringify(events?.[0], null, 2))

  // === Tenant B setup for cross-tenant isolation ===
  const { data: tenantB } = await serviceClient.from('tenants').insert([{ name: 'Tenant B Storage Test', slug: `tenant-b-storage-${Date.now()}` }]).select().single()
  const { data: unitB } = await createStorageUnit(serviceClient, tenantB!.id, { unitNumber: 'B-101', capacityCubicFeet: 100 })
  const { data: crateB } = await createCrate(serviceClient, tenantB!.id, { crateNumber: 'CRATE-B-0001', storageUnitId: unitB!.id })
  console.log('\nTenant B:', tenantB!.id, 'unit:', unitB!.id, 'crate:', crateB!.id)

  // === Test 3: cross-tenant isolation via RLS-scoped session ===
  console.log('\n=== Test 3: cross-tenant isolation ===')
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  const { data: unitsVisible } = await anonClient.from('storage_units').select('id, tenant_id, unit_number')
  const { data: cratesVisible } = await anonClient.from('crates').select('id, tenant_id, crate_number')
  console.log("Tenant A session can see Tenant B's storage unit (must be false):", (unitsVisible ?? []).some((u) => u.id === unitB!.id))
  console.log("Tenant A session can see Tenant B's crate (must be false):", (cratesVisible ?? []).some((c) => c.id === crateB!.id))
  console.log('Tenant A session sees', unitsVisible?.length, 'unit(s) and', cratesVisible?.length, 'crate(s) total (all should be its own)')

  // Direct attempt to read Tenant B's crate by exact real ID
  const { data: directRead, error: directErr } = await anonClient.from('crates').select('*').eq('id', crateB!.id).maybeSingle()
  console.log("Direct read of Tenant B's crate by real ID (must be null):", directRead, directErr?.message)

  // Cleanup
  await serviceClient.from('crates').delete().in('id', [crateA!.id, crateB!.id])
  await serviceClient.from('storage_units').delete().in('id', [unitA!.id, unitB!.id])
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nCleanup complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
