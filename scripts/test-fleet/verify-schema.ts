import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { addVehicleDocument, addVehicleMaintenance } from '../../src/modules/fleet/server/repository'
import fs from 'fs'

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: adminUser } = await serviceClient.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantAId = adminUser!.tenant_id

  // === Setup: real vehicle for Tenant A ===
  const { data: vehicleA, error: vehErrA } = await serviceClient.from('vehicles').insert({
    tenant_id: tenantAId,
    name: 'Van A',
    registration: 'AB12 CDE',
    type: 'Luton Van'
  }).select().single()
  if (vehErrA) throw vehErrA
  console.log('Tenant A vehicle:', vehicleA.id)

  // === Setup: real vehicle for Tenant B ===
  const { data: tenantB } = await serviceClient.from('tenants').insert([{ name: 'Tenant B Fleet Test', slug: `tenant-b-fleet-${Date.now()}` }]).select().single()
  const tenantBId = tenantB!.id
  const { data: vehicleB, error: vehErrB } = await serviceClient.from('vehicles').insert({
    tenant_id: tenantBId,
    name: 'Van B',
    registration: 'XY99 ZZZ',
    type: 'Luton Van'
  }).select().single()
  if (vehErrB) throw vehErrB
  console.log('Tenant B vehicle:', vehicleB.id)

  // === Test 1: Cross-tenant isolation on tables (Composite FK) ===
  console.log('\n=== Test 1: Cross-tenant isolation (Tables) ===')
  // Try to insert a document for Tenant A but pointing to Tenant B's vehicle
  const crossTenantErr = await serviceClient.from('vehicle_documents').insert({
    tenant_id: tenantAId,
    vehicle_id: vehicleB.id,
    document_type: 'insurance',
    file_path: 'fake/path.pdf',
    uploaded_by: adminUser!.id
  })
  console.log('Insert document for Tenant A linking to Tenant B vehicle — error (must be composite FK violation):', crossTenantErr.error?.message)

  // === Test 2: Enum constraint negative test ===
  console.log('\n=== Test 2: invalid enum value ===')
  const badInsert = await serviceClient.from('vehicle_maintenance_records').insert({
    tenant_id: tenantAId,
    vehicle_id: vehicleA.id,
    maintenance_type: 'wash' as any, // Not in enum
    performed_at: '2023-01-01',
    logged_by: adminUser!.id
  })
  console.log('Insert with invalid maintenance_type — error (must be enum rejection):', badInsert.error?.message)

  // === Test 3: Domain Events ===
  console.log('\n=== Test 3: Domain Event Emission ===')
  const docResult = await addVehicleDocument(serviceClient, tenantAId, {
    vehicleId: vehicleA.id,
    documentType: 'mot',
    filePath: `vehicle-documents/${tenantAId}/doc.pdf`,
    uploadedBy: adminUser!.id
  })
  console.log('addVehicleDocument() completed. new doc id:', docResult.id)

  const { data: events } = await serviceClient
    .from('domain_events')
    .select('*')
    .eq('tenant_id', tenantAId)
    .eq('event_type', 'vehicle.document_uploaded')
    .order('occurred_at', { ascending: false })
    .limit(1)
  console.log('Real domain_events row for document upload:', JSON.stringify(events?.[0], null, 2))

  // === Test 4: Storage RLS Cross-Tenant Test ===
  console.log('\n=== Test 4: Storage RLS Cross-Tenant (Real Storage API) ===')
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  const dummyFile = new Blob(['dummy content'], { type: 'text/plain' })

  // 1. Attempt to upload to Tenant B's folder
  const uploadB = await anonClient.storage
    .from('vehicle-documents')
    .upload(`${tenantBId}/test.txt`, dummyFile)
  console.log('Upload to Tenant B folder by Tenant A user (must be rejected by RLS):', uploadB.error?.message || 'Success (BAD)')

  // 2. Attempt to upload to Tenant A's folder
  const uploadA = await anonClient.storage
    .from('vehicle-documents')
    .upload(`${tenantAId}/test.txt`, dummyFile)
  console.log('Upload to Tenant A folder by Tenant A user (must succeed):', uploadA.error?.message || 'Success (GOOD)')

  // Cleanup
  await serviceClient.storage.from('vehicle-documents').remove([`${tenantAId}/test.txt`])
  await serviceClient.from('vehicle_documents').delete().eq('id', docResult.id)
  await serviceClient.from('vehicles').delete().in('id', [vehicleA.id, vehicleB.id])
  await serviceClient.from('tenants').delete().eq('id', tenantBId)
  console.log('\nCleanup complete')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
