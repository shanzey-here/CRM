import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { emitEvent } from '../../src/utils/supabase/event-bus'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: true })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const tenantId = 'db4700db-a5a8-4a52-b7d8-6ebef78195b7' // Suspend Conflict Test

  // 1. Ensure module enabled
  await supabase.from('tenant_modules').upsert({
    tenant_id: tenantId,
    module_key: 'automation_workflows',
    enabled: true
  }, { onConflict: 'tenant_id,module_key' })

  // 2. Create a dummy workflow
  const { data: wf, error: wfErr } = await supabase.from('automation_workflows').insert({
    tenant_id: tenantId,
    name: 'Test Workflow',
    is_active: true,
    trigger_event_type: 'lead.created',
    trigger_conditions: { source: 'test_script' }
  }).select('id').single()

  if (wfErr) throw wfErr

  // 3. Add an action to the workflow
  const { error: actErr } = await supabase.from('automation_workflow_actions').insert({
    tenant_id: tenantId,
    workflow_id: wf.id,
    action_type: 'create_task',
    action_config: { title: 'Workflow Task Test' },
    sort_order: 1
  })

  if (actErr) throw actErr

  // 4. Fire the event!
  console.log('Firing event...')
  const dummyUuid = 'e8ef504e-b281-46e0-bb92-319d5834099d'
  const payload = { source: 'test_script', lead_id: dummyUuid }
  const { data: eventId, error: emitErr } = await emitEvent(supabase, 'lead.created', 'test', payload, tenantId)
  
  if (emitErr) throw emitErr
  console.log('Event fired:', eventId)

  // Wait a sec just in case (though it is synchronous, so we don't strictly need to)
  
  // 5. Check execution log
  const { data: logs } = await supabase
    .from('automation_workflow_execution_log')
    .select('*')
    .eq('event_id', eventId)

  console.log('Execution Logs:', JSON.stringify(logs, null, 2))

  // Clean up
  await supabase.from('automation_workflows').delete().eq('id', wf.id)
  
  console.log('Test complete')
}

run().catch(console.error)
