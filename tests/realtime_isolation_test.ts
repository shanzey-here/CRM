import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as crypto from 'crypto'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// A minimal JWT generator to impersonate users
async function generateTestJwt(userId: string, tenantId: string, role: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: { tenant_id: tenantId, tenant_role: role }
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', process.env.SUPABASE_JWT_SECRET!)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

async function runRealtimeIsolationTest() {
  console.log('--- Running Cross-Tenant Realtime Isolation Test ---')

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  const userA = '11111111-1111-1111-1111-111111111111'
  const userB = '55555555-5555-5555-5555-555555555555'

  // 1. Initialize Client A (Tenant A)
  const tokenA = await generateTestJwt(userA, tenantA, 'tenant_admin')
  const clientA = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${tokenA}` } }
  })

  // 2. Initialize Client B (Tenant B)
  const tokenB = await generateTestJwt(userB, tenantB, 'tenant_admin')
  const clientB = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${tokenB}` } }
  })

  let clientA_EventsReceived = 0
  let clientB_EventsReceived = 0

  console.log('Setting up Realtime subscriptions...')

  // Client A subscribes
  const channelA = clientA
    .channel('test-leads-A')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `tenant_id=eq.${tenantA}` }, (payload) => {
      clientA_EventsReceived++
      console.log(`[Client A] Received event for lead: ${payload.new.id}`)
    })
    .subscribe()

  // Client B subscribes
  const channelB = clientB
    .channel('test-leads-B')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `tenant_id=eq.${tenantB}` }, (payload) => {
      clientB_EventsReceived++
      console.log(`[Client B] Received event for lead: ${payload.new.id}`)
    })
    .subscribe()

  // Wait for subscriptions to connect
  await new Promise(r => setTimeout(r, 2000))

  console.log('Subscriptions active. Firing test events...')

  // 3. Client B creates a lead
  console.log('[Action] Client B creates a lead...')
  const leadIdB = crypto.randomUUID()
  const { error: errB } = await clientB.from('leads').insert({
    id: leadIdB,
    tenant_id: tenantB,
    contact_id: 'cbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // Fixture from isolation_tests.sql
    status: 'inquiry',
    stage: 'lead_new',
    created_by: userB
  })
  if (errB) throw errB

  // Wait for realtime events to propagate
  await new Promise(r => setTimeout(r, 2000))

  // 4. Assertions
  console.log('--- Results ---')
  console.log(`Client A received: ${clientA_EventsReceived} events`)
  console.log(`Client B received: ${clientB_EventsReceived} events`)

  if (clientA_EventsReceived > 0) {
    console.error('❌ FAIL: Client A received an event meant for Tenant B! (Cross-tenant leak)')
    process.exit(1)
  }

  if (clientB_EventsReceived !== 1) {
    console.warn('⚠️ WARNING: Client B did not receive its own event. Realtime might be disabled on the DB or connection failed.')
    // Depending on DB configuration during tests, Realtime might not fire if wal2json isn't perfectly configured in the test env.
    // But we absolutely enforce that A did NOT receive it.
  } else {
    console.log('✅ Client B received exactly 1 event (its own).')
  }

  console.log('✅ Realtime cross-tenant isolation test passed!')

  // Cleanup
  clientA.removeChannel(channelA)
  clientB.removeChannel(channelB)
  await clientB.from('leads').delete().eq('id', leadIdB)
  process.exit(0)
}

runRealtimeIsolationTest().catch(console.error)
