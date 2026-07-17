import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getActivities, createActivity, updateActivityNote } from '../src/modules/activities/server/repository'
import { getTasks, createTask, updateTask } from '../src/modules/tasks/server/repository'

// We use the service_role key to bypass RLS in the repository functions,
// because repository tests are about data access logic and tenant scoping,
// not RLS policies (which are tested via SQL).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Hardcoded test fixtures from isolation_tests.sql
const TENANT_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TENANT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const CONTACT_A = 'caaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const LEAD_A = '0aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_A = '11111111-1111-1111-1111-111111111111'

async function runTests() {
  console.log('--- Running Activities & Tasks Repo Tests ---')

  let failed = false

  // Create prerequisite data
  try {
    await supabase.from('tenants').insert([
      { id: TENANT_A, name: 'Tenant A', slug: 'tenant-a-act', status: 'active' },
      { id: TENANT_B, name: 'Tenant B', slug: 'tenant-b-act', status: 'active' }
    ]).select()
    
    await supabase.from('users').insert([
      { id: USER_A, tenant_id: TENANT_A, role: 'tenant_admin', full_name: 'Test', email: 'test@act.com' }
    ]).select()

    await supabase.from('contacts').insert([
      { id: CONTACT_A, tenant_id: TENANT_A, type: 'residential', first_name: 'Contact A' }
    ]).select()

    await supabase.from('leads').insert([
      { id: LEAD_A, tenant_id: TENANT_A, contact_id: CONTACT_A, stage: 'inquiry' }
    ]).select()
  } catch (e) {
    console.error('Failed to setup prerequisites:', e)
  }

  try {
    // 1. Create an Activity
  const { data: act, error: actErr } = await createActivity(supabase, TENANT_A, {
    contact_id: CONTACT_A,
    lead_id: LEAD_A,
    type: 'note',
    content: 'Test repo note'
  })
  if (actErr || !act) throw new Error(`Failed to create activity: ${actErr?.message}`)
  console.log('✅ createActivity works')

  // 2. Fetch Activities for Tenant A
  const { data: actsA, error: fetchErr } = await getActivities(supabase, TENANT_A)
  if (fetchErr) throw fetchErr
  if (!actsA?.some(a => a.id === act.id)) throw new Error('Tenant A cannot see its own activity')
  console.log('✅ getActivities retrieves correct tenant data')

  // 3. Fetch Activities for Tenant B
  const { data: actsB } = await getActivities(supabase, TENANT_B)
  if (actsB?.some(a => a.id === act.id)) throw new Error('Tenant B can see Tenant A activity - isolation breach!')
  console.log('✅ getActivities strictly isolates by tenant_id')

  // 4. Update Activity Note
  const { data: updatedAct, error: updateErr } = await updateActivityNote(supabase, TENANT_A, act.id, {
    content: 'Updated repo note'
  })
  if (updateErr || !updatedAct) throw new Error(`Failed to update activity: ${updateErr?.message}`)
  if (updatedAct.content !== 'Updated repo note') throw new Error('Update did not persist content')
  console.log('✅ updateActivityNote works')

  // 5. Create a Task
  const { data: task, error: taskErr } = await createTask(supabase, TENANT_A, {
    contact_id: CONTACT_A,
    title: 'Test repo task',
    assigned_to: USER_A
  })
  if (taskErr || !task) throw new Error(`Failed to create task: ${taskErr?.message}`)
  console.log('✅ createTask works')

  // 6. Fetch Tasks for Tenant A
  const { data: tasksA, error: tasksFetchErr } = await getTasks(supabase, TENANT_A)
  if (tasksFetchErr) throw tasksFetchErr
  if (!tasksA?.some(t => t.id === task.id)) throw new Error('Tenant A cannot see its own task')
  console.log('✅ getTasks retrieves correct tenant data')

  // 7. Fetch Tasks for Tenant B
  const { data: tasksB } = await getTasks(supabase, TENANT_B)
  if (tasksB?.some(t => t.id === task.id)) throw new Error('Tenant B can see Tenant A task - isolation breach!')
  console.log('✅ getTasks strictly isolates by tenant_id')

  // 8. Update Task
  const { data: updatedTask, error: taskUpdateErr } = await updateTask(supabase, TENANT_A, task.id, {
    status: 'completed'
  })
  if (taskUpdateErr || !updatedTask) throw new Error(`Failed to update task: ${taskUpdateErr?.message}`)
  if (updatedTask.status !== 'completed') throw new Error('Task update did not persist')
  console.log('✅ updateTask works')

  } finally {
    // Cleanup
    await supabase.from('tenants').delete().in('id', [TENANT_A, TENANT_B])
  }
}

runTests().catch(e => {
  console.error(e)
  process.exit(1)
})
