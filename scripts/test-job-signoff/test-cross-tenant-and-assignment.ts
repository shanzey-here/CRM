import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: { users } } = await serviceClient.auth.admin.listUsers()
  const crewA = users.find((u) => u.email === 'crewa@example.com')
  if (!crewA) throw new Error('crewa@example.com not found')

  const { data: crewAUserRow } = await serviceClient.from('users').select('tenant_id').eq('id', crewA.id).single()
  const tenantAId = crewAUserRow!.tenant_id
  console.log('Crew A user:', crewA.id, 'tenant A:', tenantAId)

  // ========== Fixture 1: a job in Crew A's OWN tenant, but NOT assigned to Crew A ==========
  const { data: contactSameTenant } = await serviceClient
    .from('contacts')
    .insert({ tenant_id: tenantAId, first_name: 'Unassigned', last_name: 'JobContact', type: 'residential' })
    .select()
    .single()
  const { data: unassignedJob } = await serviceClient
    .from('jobs')
    .insert({ tenant_id: tenantAId, contact_id: contactSameTenant!.id, status: 'scheduled', move_date: new Date().toISOString().slice(0, 10) })
    .select()
    .single()
  console.log('Unassigned (same-tenant) job:', unassignedJob!.id, '- Crew A has NO job_crew_assignments row for this job')

  // ========== Fixture 2: a real Tenant B with its own crew-assigned job ==========
  const { data: tenantB } = await serviceClient
    .from('tenants')
    .insert([{ name: 'Tenant B Crew Signoff Test', slug: `tenant-b-crew-signoff-${Date.now()}` }])
    .select()
    .single()
  const { data: contactB } = await serviceClient
    .from('contacts')
    .insert({ tenant_id: tenantB!.id, first_name: 'TenantB', last_name: 'Contact', type: 'residential' })
    .select()
    .single()
  const { data: jobB } = await serviceClient
    .from('jobs')
    .insert({ tenant_id: tenantB!.id, contact_id: contactB!.id, status: 'scheduled', move_date: new Date().toISOString().slice(0, 10) })
    .select()
    .single()
  console.log('Tenant B job:', jobB!.id, 'tenant B:', tenantB!.id)

  // ========== Real RLS-scoped session as Crew A ==========
  const crewAClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await crewAClient.auth.signInWithPassword({ email: 'crewa@example.com', password: 'password123' })
  if (signInErr) throw signInErr

  console.log('\n========== 1. Crew A reading the UNASSIGNED same-tenant job directly (RLS crew_select requires an assignment) ==========')
  const { data: readUnassigned, error: readUnassignedErr } = await crewAClient.from('jobs').select('*').eq('id', unassignedJob!.id).maybeSingle()
  console.log('Result (must be null — RLS crew_select filters by job_crew_assignments membership):', readUnassigned, 'error:', readUnassignedErr?.message)

  console.log('\n========== 2. Crew A attempting to INSERT a job_signoffs row for the unassigned job (real RLS INSERT policy check) ==========')
  const { data: insertUnassigned, error: insertUnassignedErr } = await crewAClient
    .from('job_signoffs')
    .insert({
      tenant_id: tenantAId,
      job_id: unassignedJob!.id,
      signature_name: 'Malicious Attempt',
      signature_storage_path: 'fake/path.png',
      document_hash: 'fakehash',
    })
    .select()
  console.log('Insert result (must be null/blocked):', insertUnassigned, 'error:', insertUnassignedErr?.message)

  console.log('\n========== 3. Crew A reading Tenant B job directly (cross-tenant, must be blocked) ==========')
  const { data: readCrossTenant, error: readCrossTenantErr } = await crewAClient.from('jobs').select('*').eq('id', jobB!.id).maybeSingle()
  console.log('Result (must be null):', readCrossTenant, 'error:', readCrossTenantErr?.message)

  console.log('\n========== 4. Crew A attempting to INSERT a job_signoffs row for the Tenant B job (cross-tenant) ==========')
  const { data: insertCrossTenant, error: insertCrossTenantErr } = await crewAClient
    .from('job_signoffs')
    .insert({
      tenant_id: tenantB!.id, // even if the attacker knows and supplies the real tenant_id
      job_id: jobB!.id,
      signature_name: 'Malicious Cross-Tenant Attempt',
      signature_storage_path: 'fake/path2.png',
      document_hash: 'fakehash2',
    })
    .select()
  console.log('Insert result (must be null/blocked):', insertCrossTenant, 'error:', insertCrossTenantErr?.message)

  console.log('\n========== 5. Confirm neither job actually got a real signoff row or status change ==========')
  const { data: unassignedJobAfter } = await serviceClient.from('jobs').select('status').eq('id', unassignedJob!.id).single()
  const { data: jobBAfter } = await serviceClient.from('jobs').select('status').eq('id', jobB!.id).single()
  const { data: signoffsForUnassigned } = await serviceClient.from('job_signoffs').select('id').eq('job_id', unassignedJob!.id)
  const { data: signoffsForJobB } = await serviceClient.from('job_signoffs').select('id').eq('job_id', jobB!.id)
  console.log('Unassigned job status (must still be scheduled):', unassignedJobAfter?.status)
  console.log('Tenant B job status (must still be scheduled):', jobBAfter?.status)
  console.log('Signoffs on unassigned job (must be 0):', signoffsForUnassigned?.length)
  console.log('Signoffs on Tenant B job (must be 0):', signoffsForJobB?.length)

  // ========== Cleanup ==========
  await serviceClient.from('jobs').delete().eq('id', unassignedJob!.id)
  await serviceClient.from('contacts').delete().eq('id', contactSameTenant!.id)
  await serviceClient.from('jobs').delete().eq('id', jobB!.id)
  await serviceClient.from('contacts').delete().eq('id', contactB!.id)
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nCleanup complete.')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
