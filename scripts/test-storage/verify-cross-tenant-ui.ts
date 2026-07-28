import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: admin } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantAId = admin!.tenant_id

  const { data: tenantB } = await serviceClient
    .from('tenants')
    .insert([{ name: 'Tenant B Crate UI Test', slug: `tenant-b-crate-ui-${Date.now()}` }])
    .select()
    .single()

  const { data: unitB } = await serviceClient
    .from('storage_units')
    .insert({ tenant_id: tenantB!.id, unit_number: 'B-UNIT-1', capacity_cubic_feet: 200 })
    .select()
    .single()

  const { data: crateB } = await serviceClient
    .from('crates')
    .insert({ tenant_id: tenantB!.id, crate_number: 'B-CRATE-1', storage_unit_id: unitB!.id })
    .select()
    .single()

  console.log('Tenant B:', tenantB!.id, 'unit:', unitB!.id, 'crate:', crateB!.id)

  // RLS-scoped session as Tenant A
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  const { data: unitsVisible } = await anonClient.from('storage_units').select('id, tenant_id')
  const { data: cratesVisible } = await anonClient.from('crates').select('id, tenant_id')
  console.log("Tenant A can see Tenant B's unit (must be false):", (unitsVisible ?? []).some((u) => u.id === unitB!.id))
  console.log("Tenant A can see Tenant B's crate (must be false):", (cratesVisible ?? []).some((c) => c.id === crateB!.id))

  const { data: directCrate } = await anonClient.from('crates').select('*').eq('id', crateB!.id).maybeSingle()
  console.log("Direct fetch of Tenant B's crate by real ID as Tenant A (must be null):", directCrate)

  // Attempt to "modify" via updateCrateAssociations-equivalent scoped update as tenant A
  const { updateCrateAssociations } = await import('../../src/modules/storage/server/repository')
  const modifyResult = await updateCrateAssociations(anonClient as any, tenantAId, crateB!.id, { storageUnitId: null })
  console.log("Tenant A attempting to modify Tenant B's crate via the real repository function — data (must be null):", JSON.stringify(modifyResult.data))

  const { data: crateBAfter } = await serviceClient.from('crates').select('storage_unit_id').eq('id', crateB!.id).single()
  console.log("Tenant B's crate storage_unit_id after Tenant A's attempted modification (must be unchanged):", crateBAfter?.storage_unit_id, '== original:', crateBAfter?.storage_unit_id === unitB!.id)

  // Cleanup
  await serviceClient.from('crates').delete().eq('id', crateB!.id)
  await serviceClient.from('storage_units').delete().eq('id', unitB!.id)
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nCleanup complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
