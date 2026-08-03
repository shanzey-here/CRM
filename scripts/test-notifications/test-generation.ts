import { createClient } from '@supabase/supabase-js'
import { emitEvent } from '../../src/utils/supabase/event-bus'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getTestUsers() {
  const { data: tenants } = await supabase.from('tenants').select('id, name')
  
  for (const t of tenants!) {
    const { data: users } = await supabase.from('users').select('*').eq('tenant_id', t.id)
    const adminA = users?.find(u => u.role === 'tenant_admin')
    const dispatcherA = users?.find(u => u.role === 'dispatcher')
    const crewA = users?.find(u => u.role === 'crew')
    
    if (adminA && dispatcherA && crewA) {
      const tenantB = tenants!.find(other => other.id !== t.id) || t
      return { tenantA: t, tenantB, adminA, dispatcherA, crewA }
    }
  }
  
  throw new Error('Could not find a tenant with admin, dispatcher, and crew')
}

async function runTests() {
  console.log('--- Starting Notification Generation Tests ---')
  const { tenantA, tenantB, adminA, dispatcherA, crewA, usersB } = await getTestUsers()
  
  // Clean up any previous test state
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all

  // 1. Test Broadcast Notification
  console.log('\n1. Testing Broadcast (new_lead)...')
  const dummyLeadId = crypto.randomUUID()
  const { data: event1Id, error: err1 } = await emitEvent(supabase, 'lead.created', 'crm', { lead_id: dummyLeadId }, tenantA.id)
  if (err1) throw err1

  // Wait a tick for async insertions (if any, though they should be synchronous inside the generator, 
  // the emitEvent function itself awaits the generator so it should be there immediately).
  
  const { data: broadcastNotifs } = await supabase.from('notifications').select('*').eq('source_event_id', event1Id)
  
  const hasAdmin = broadcastNotifs?.some(n => n.target_user_id === adminA.id)
  const hasDispatcher = broadcastNotifs?.some(n => n.target_user_id === dispatcherA.id)
  const hasCrew = broadcastNotifs?.some(n => n.target_user_id === crewA.id)
  const hasTenantB = broadcastNotifs?.some(n => n.tenant_id === tenantB.id)

  console.log(`  Created ${broadcastNotifs?.length} rows for event ${event1Id}`)
  console.log(`  -> AdminA received: ${hasAdmin}`)
  console.log(`  -> DispatcherA received: ${hasDispatcher}`)
  console.log(`  -> CrewA received (should be false): ${hasCrew}`)
  console.log(`  -> Tenant B leaked (should be false): ${hasTenantB}`)

  // 2. Test Targeted Notification
  console.log('\n2. Testing Targeted (task_assigned)...')
  const dummyTaskId = crypto.randomUUID()
  const { data: event2Id, error: err2 } = await emitEvent(supabase, 'task.assigned', 'crm', { task_id: dummyTaskId, assigned_to: crewA.id, title: 'Wash truck' }, tenantA.id)
  if (err2) throw err2

  const { data: targetedNotifs } = await supabase.from('notifications').select('*').eq('source_event_id', event2Id)
  const hasAdminTargeted = targetedNotifs?.some(n => n.target_user_id === adminA.id)
  const hasCrewTargeted = targetedNotifs?.some(n => n.target_user_id === crewA.id)

  console.log(`  Created ${targetedNotifs?.length} rows for event ${event2Id}`)
  console.log(`  -> AdminA received (should be false): ${hasAdminTargeted}`)
  console.log(`  -> CrewA received: ${hasCrewTargeted}`)

  // 3. Test Read State Independence
  console.log('\n3. Testing Read State...')
  const adminNotif = broadcastNotifs?.find(n => n.target_user_id === adminA.id)!
  const dispatchNotif = broadcastNotifs?.find(n => n.target_user_id === dispatcherA.id)!

  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', adminNotif.id)

  const { data: readCheck } = await supabase.from('notifications').select('id, read_at').in('id', [adminNotif.id, dispatchNotif.id])
  const updatedAdmin = readCheck?.find(n => n.id === adminNotif.id)
  const updatedDispatch = readCheck?.find(n => n.id === dispatchNotif.id)

  console.log(`  -> AdminA notification read_at: ${updatedAdmin?.read_at ? 'SET' : 'NULL'} (should be SET)`)
  console.log(`  -> DispatcherA notification read_at: ${updatedDispatch?.read_at ? 'SET' : 'NULL'} (should be NULL)`)

  // 4. Test Error Isolation
  console.log('\n4. Testing Error Isolation...')
  // We trigger 'error_test' which explicitly throws inside generator.ts
  let survived = false
  try {
    const { data: errEventId, error: err3 } = await emitEvent(supabase, 'error_test', 'crm', { test: true }, tenantA.id)
    if (!err3 && errEventId) {
      survived = true
      console.log(`  -> emitEvent successfully returned despite generation crash! Event ID: ${errEventId}`)
    } else {
      console.log(`  -> emitEvent returned error:`, err3)
    }
  } catch (e) {
    console.log(`  -> emitEvent threw an exception!`, e)
  }
  
  console.log(`  -> Did emitEvent survive the broken generator? ${survived}`)
}

runTests().catch(console.error)
