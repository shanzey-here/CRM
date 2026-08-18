import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { spawn } from 'child_process'
import FormData from 'form-data'
import fetch from 'node-fetch'

config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('--- Starting Fleet UI Layer Verification ---')
  
  // 1. Setup Tenant A and Tenant B
  const { data: admin } = await serviceClient.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantAId = admin!.tenant_id
  
  const { data: crew } = await serviceClient.from('users').select('id, tenant_id').eq('email', 'crew@devtest.local').single()
  
  const { data: tenantB } = await serviceClient.from('tenants').insert([{ name: 'Tenant B Fleet UI', slug: `tenant-b-fleet-ui-${Date.now()}` }]).select().single()
  const tenantBId = tenantB!.id

  const { data: vehicleA } = await serviceClient.from('vehicles').insert({ tenant_id: tenantAId, name: 'Van A' }).select().single()
  const { data: vehicleB } = await serviceClient.from('vehicles').insert({ tenant_id: tenantBId, name: 'Van B' }).select().single()

  console.log('Test vehicles created. A:', vehicleA!.id, 'B:', vehicleB!.id)

  // 2. Start Next.js dev server for real Server Action testing
  console.log('\n[1] Starting Next.js server...')
  const nextProc = spawn('npm', ['run', 'dev'], { shell: true })
  
  let nextReady = false
  nextProc.stdout.on('data', (data) => {
    const msg = data.toString()
    if (msg.includes('Ready in') || msg.includes('compiled in')) nextReady = true
  })
  
  let waitCount = 0
  while (!nextReady && waitCount < 20) {
    await sleep(1000)
    waitCount++
  }

  if (!nextReady) {
    console.error('Failed to start Next.js.')
    nextProc.kill()
    process.exit(1)
  }
  console.log('Next.js server is ready.')

  // 3. Test Cross-Tenant UI Upload Path (Client side upload as Tenant A Admin)
  console.log('\n[2] Testing Cross-Tenant Direct Storage Upload (Client-Side logic)...')
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await anonClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  
  const dummyFile = new Blob(['dummy content'], { type: 'text/plain' })
  
  // Attempt to upload directly to Tenant B's bucket folder exactly like the UI does
  const uploadFail = await anonClient.storage.from('vehicle-documents').upload(`${tenantBId}/test_ui_${Date.now()}.txt`, dummyFile)
  console.log("Upload to Tenant B's folder by Tenant A admin — error (must be RLS rejection):", uploadFail.error?.message || 'SUCCESS (BAD)')

  const uploadSuccess = await anonClient.storage.from('vehicle-documents').upload(`${tenantAId}/test_ui_${Date.now()}.txt`, dummyFile)
  console.log("Upload to Tenant A's folder by Tenant A admin — error (must be success):", uploadSuccess.error?.message || 'SUCCESS (GOOD)')

  // 4. Test Crew Restriction via Real Server Action (API wrapper over Server Action)
  console.log('\n[3] Testing Crew Restriction on Real Server Action (API wrapper over Server Action)...')
  const { data: { session: crewSession } } = await anonClient.auth.signInWithPassword({ email: 'crew@devtest.local', password: 'DevTest123!' })
  
  const res = await fetch('http://localhost:3000/api/test-fleet-action', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${crewSession!.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vehicleId: vehicleA!.id,
      documentType: 'mot',
      filePath: `${tenantAId}/test_ui.txt`
    })
  })
  
  console.log(`Server Action API status: ${res.status} ${res.statusText}, Redirected: ${res.redirected}, URL: ${res.url}`)

  const actionResultText = await res.text()
  try {
    const actionResult = JSON.parse(actionResultText)
    console.log('Server Action result for Crew member (must be rejected):', actionResult)
  } catch(e) {
    console.log('Failed to parse JSON. Response was:', actionResultText.substring(0, 500))
  }

  // 5. Cleanup
  console.log('\n[4] Cleanup...')
  nextProc.kill()
  await serviceClient.storage.from('vehicle-documents').remove([`${tenantAId}/test_ui.txt`])
  await serviceClient.from('vehicles').delete().in('id', [vehicleA!.id, vehicleB!.id])
  await serviceClient.from('tenants').delete().eq('id', tenantBId)
  console.log('Cleanup complete.')
  process.exit(0)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
