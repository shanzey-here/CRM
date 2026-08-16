import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/types/database.types'
import { executeWorkflows } from '../src/modules/workflows/server/engine'
import { GET as ResumeCron } from '../src/app/api/cron/workflows-resume/route'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('--- Phase 3 Workflow Expansion Verification ---')
  
  let { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
  if (!tenant) {
    const { data: newTenant } = await supabase.from('tenants').insert({ name: 'Test Tenant', slug: 'test-tenant' }).select('id').single()
    tenant = newTenant
  }
  const tenantId = tenant!.id

  await supabase.from('tenant_modules').upsert({ tenant_id: tenantId, module_name: 'automation_workflows', is_enabled: true })
  await supabase.from('automation_workflows').delete().eq('tenant_id', tenantId).like('name', 'TEST_%')

  const insertEvent = async (eventType: any, payload: any) => {
    const id = crypto.randomUUID()
    const { error } = await supabase.from('domain_events').insert({
      id, tenant_id: tenantId, event_type: eventType, payload, source_module: 'test'
    })
    if (error) {
      console.error(`ERROR Inserting domain event (${eventType}):`, error)
      throw error
    }
    return id
  }

  try {
    // ---------------------------------------------------------
    // TEST 5: Regression Test (Pre-expansion simple workflow)
    // ---------------------------------------------------------
    console.log('\n[Test 5] Running Regression Test (Linear Workflow)...')
    const { data: w1, error: e1 } = await supabase.from('automation_workflows').insert({
      tenant_id: tenantId, name: 'TEST_REGRESSION', trigger_event_type: 'lead.created', is_active: true, trigger_conditions: { source: 'website' }
    }).select('id').single()
    if (e1) throw e1

    await supabase.from('automation_workflow_actions').insert({
      tenant_id: tenantId, workflow_id: w1!.id, action_type: 'update_lead_stage', action_config: { stage: 'inquiry' }, sort_order: 0
    })

    const mockLeadId = crypto.randomUUID()
    await supabase.from('leads').upsert({ id: mockLeadId, tenant_id: tenantId, first_name: 'Test', last_name: 'Regression', stage: 'inquiry' })

    const dummyEventId = await insertEvent('lead.created', { source: 'website', lead_id: mockLeadId })
    await executeWorkflows(supabase, 'lead.created', { source: 'website', lead_id: mockLeadId }, dummyEventId, tenantId)
    
    const { data: log1 } = await supabase.from('automation_workflow_execution_log').select('*').eq('event_id', dummyEventId).eq('workflow_id', w1!.id).single()
    console.log(`✓ Regression test finished with status: ${log1?.status}`)
    console.log(`✓ Action logs:`, JSON.stringify(log1?.logs))

    // ---------------------------------------------------------
    // TEST 1: Delay End-to-End & TEST 4: New Action
    // ---------------------------------------------------------
    console.log('\n[Test 1 & 4] Running Delay & New Actions (send_email) Test...')
    const { data: w2, error: e2 } = await supabase.from('automation_workflows').insert({
      tenant_id: tenantId, name: 'TEST_DELAY_EMAIL', trigger_event_type: 'quote.sent', is_active: true, trigger_conditions: {}
    }).select('id').single()
    if (e2) throw e2

    await supabase.from('automation_workflow_actions').insert([
      { tenant_id: tenantId, workflow_id: w2!.id, action_type: 'delay', action_config: { delay_hours: 0, delay_minutes: 0 }, sort_order: 0 },
      { tenant_id: tenantId, workflow_id: w2!.id, action_type: 'send_email', action_config: { to: 'test@example.com', subject: 'Test', body: 'Hello' }, sort_order: 1 }
    ])

    const eventIdDelay = await insertEvent('quote.sent', { quote_id: '123' })
    await executeWorkflows(supabase, 'quote.sent', { quote_id: '123' }, eventIdDelay, tenantId)

    const { data: pendingStep } = await supabase.from('automation_workflow_pending_steps').select('*').eq('workflow_id', w2!.id).single()
    console.log(`✓ Row landed in pending_steps: payload=${JSON.stringify(pendingStep?.payload)}, next_sort_order=${pendingStep?.next_action_sort_order}`)
    
    const { data: logDelayPre } = await supabase.from('automation_workflow_execution_log').select('*').eq('event_id', eventIdDelay).eq('workflow_id', w2!.id).single()
    console.log(`✓ Execution log status before cron: ${logDelayPre?.status}`)

    console.log('  -> Manually triggering cron sweeper...')
    const cronReq = new Request('http://localhost:3000/api/cron/workflows-resume', {
      headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
    })
    const cronRes = await ResumeCron(cronReq)
    console.log(`  -> Cron response: ${JSON.stringify(await cronRes.json())}`)

    const { data: logDelayPost } = await supabase.from('automation_workflow_execution_log').select('*').eq('event_id', eventIdDelay).eq('workflow_id', w2!.id).single()
    console.log(`✓ Execution log status after cron: ${logDelayPost?.status}`)
    console.log(`✓ Final action logs:`, JSON.stringify(logDelayPost?.logs))

    // ---------------------------------------------------------
    // TEST 2 & 3: Condition Branches & Missing Fields
    // ---------------------------------------------------------
    console.log('\n[Test 2 & 3] Running Condition Branches & Missing Fields...')
    const { data: w3, error: e3 } = await supabase.from('automation_workflows').insert({
      tenant_id: tenantId, name: 'TEST_CONDITION', trigger_event_type: 'job.completed', is_active: true, trigger_conditions: {}
    }).select('id').single()
    if (e3) throw e3

    await supabase.from('automation_workflow_actions').insert([
      { tenant_id: tenantId, workflow_id: w3!.id, action_type: 'condition', action_config: { field: 'amount', operator: '>', value: 1000, false_branch_jump_to: 2 }, sort_order: 0 },
      { tenant_id: tenantId, workflow_id: w3!.id, action_type: 'send_sms', action_config: { phone: '123', message: 'True Branch' }, sort_order: 1 },
      { tenant_id: tenantId, workflow_id: w3!.id, action_type: 'notify_staff', action_config: { user_id: 'abc', message: 'False Branch' }, sort_order: 2 }
    ])

    const eventIdCondTrue = await insertEvent('job.completed', { amount: 1500 })
    await executeWorkflows(supabase, 'job.completed', { amount: 1500 }, eventIdCondTrue, tenantId)
    const { data: logCondTrue } = await supabase.from('automation_workflow_execution_log').select('*').eq('event_id', eventIdCondTrue).eq('workflow_id', w3!.id).single()
    console.log(`✓ True Branch Execution (amount: 1500): Action types run:`, logCondTrue?.logs.map((l:any) => l.type))

    const eventIdCondFalse = await insertEvent('job.completed', { amount: 500 })
    await executeWorkflows(supabase, 'job.completed', { amount: 500 }, eventIdCondFalse, tenantId)
    const { data: logCondFalse } = await supabase.from('automation_workflow_execution_log').select('*').eq('event_id', eventIdCondFalse).eq('workflow_id', w3!.id).single()
    console.log(`✓ False Branch Execution (amount: 500): Action types run:`, logCondFalse?.logs.map((l:any) => l.type))

    const eventIdCondMissing = await insertEvent('job.completed', { other_field: 'hello' })
    await executeWorkflows(supabase, 'job.completed', { other_field: 'hello' }, eventIdCondMissing, tenantId)
    const { data: logCondMissing } = await supabase.from('automation_workflow_execution_log').select('*').eq('event_id', eventIdCondMissing).eq('workflow_id', w3!.id).single()
    console.log(`✓ Missing Field Execution (no amount provided): Action types run:`, logCondMissing?.logs.map((l:any) => l.type))

    // ---------------------------------------------------------
    // TEST 6: CRON_SECRET Rejection
    // ---------------------------------------------------------
    console.log('\n[Test 6] Running CRON_SECRET Rejection Test...')
    const badReq = new Request('http://localhost:3000/api/cron/workflows-resume', { headers: { 'Authorization': `Bearer BAD_SECRET` } })
    console.log(`✓ Unauthorized request returned status: ${(await ResumeCron(badReq)).status}`)
    
    const missingReq = new Request('http://localhost:3000/api/cron/workflows-resume')
    console.log(`✓ Missing auth request returned status: ${(await ResumeCron(missingReq)).status}`)

  } catch (err) {
    console.error('Test script failed:', err)
  } finally {
    console.log('\nCleaning up...')
    await supabase.from('automation_workflows').delete().eq('tenant_id', tenantId).like('name', 'TEST_%')
  }
}

runTests()
