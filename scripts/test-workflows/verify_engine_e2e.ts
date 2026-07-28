import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { createLead } from '../../src/modules/leads/server/repository'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: true })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function run() {
  const tenantA = 'db4700db-a5a8-4a52-b7d8-6ebef78195b7' // Suspend Conflict Test
  const tenantB = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1' // Another test tenant

  console.log('\n--- 1. Testing Cross-Tenant Isolation ---')
  // Enable module for both
  await supabase.from('tenant_modules').upsert({ tenant_id: tenantA, module_key: 'automation_workflows', enabled: true }, { onConflict: 'tenant_id,module_key' })
  await supabase.from('tenant_modules').upsert({ tenant_id: tenantB, module_key: 'automation_workflows', enabled: true }, { onConflict: 'tenant_id,module_key' })

  // Create workflow in Tenant A
  const { data: wfA } = await supabase.from('automation_workflows').insert({
    tenant_id: tenantA,
    name: 'Cross-Tenant Test WF',
    is_active: true,
    trigger_event_type: 'lead.created',
    trigger_conditions: {}
  }).select('id').single()

  await supabase.from('automation_workflow_actions').insert({
    tenant_id: tenantA,
    workflow_id: wfA!.id,
    action_type: 'update_lead_stage',
    action_config: { stage: 'quote_sent' },
    sort_order: 1
  })

  // Trigger event in Tenant B!
  const { data: contactB } = await supabase.from('contacts').insert({ tenant_id: tenantB, type: 'residential', first_name: 'IsolB' }).select('id').single()
  await createLead(supabase, tenantB, { contact_id: contactB!.id, stage: 'inquiry', source: 'website_form' }) // this emits lead.created for tenantB!

  // Check logs for workflow A
  const { data: logsA } = await supabase.from('automation_workflow_execution_log').select('*').eq('workflow_id', wfA!.id)
  console.log(`Workflow in Tenant A fired ${logsA!.length} times for Tenant B's event. (Expected 0)`)


  console.log('\n--- 2. Testing Error Isolation & Partial Failure ---')
  // Workflow in Tenant A with one good action and one deliberately broken action
  const { data: wfPartial } = await supabase.from('automation_workflows').insert({
    tenant_id: tenantA,
    name: 'Partial Failure & Error Isolation WF',
    is_active: true,
    trigger_event_type: 'lead.created',
    trigger_conditions: {}
  }).select('id').single()

  // Good action
  await supabase.from('automation_workflow_actions').insert({
    tenant_id: tenantA,
    workflow_id: wfPartial!.id,
    action_type: 'update_lead_stage',
    action_config: { stage: 'survey_scheduled' },
    sort_order: 1
  })
  
  // Bad action (violates foreign key for assigned_to)
  await supabase.from('automation_workflow_actions').insert({
    tenant_id: tenantA,
    workflow_id: wfPartial!.id,
    action_type: 'create_task',
    action_config: { assigned_to: '00000000-0000-0000-0000-000000000000' }, // Invalid user UUID
    sort_order: 2
  })

  // Trigger event in Tenant A! (Simulating public API POST)
  console.log('Calling createLead() (which synchronously fires executeWorkflows)...')
  const { data: contactA } = await supabase.from('contacts').insert({ tenant_id: tenantA, type: 'residential', first_name: 'LeadA' }).select('id').single()
  
  let leadCreationSucceeded = false
  let leadId = null
  try {
    const { data: newLead } = await createLead(supabase, tenantA, { contact_id: contactA!.id, stage: 'inquiry', source: 'website_form' })
    leadCreationSucceeded = !!newLead
    leadId = newLead?.id
  } catch (e) {
    console.error('CRASH! Lead creation failed due to workflow error:', e)
  }

  console.log(`Lead Creation Succeeded? ${leadCreationSucceeded}`)
  
  if (leadCreationSucceeded) {
    // Check if the successful action (update_lead_stage) actually ran!
    const { data: leadCheck } = await supabase.from('leads').select('stage').eq('id', leadId).single()
    console.log(`Lead stage is now: ${leadCheck!.stage} (Expected: survey_scheduled)`)

    // Check the execution log to confirm partial status
    const { data: logPartial } = await supabase.from('automation_workflow_execution_log').select('*').eq('workflow_id', wfPartial!.id).order('created_at', { ascending: false }).limit(1).single()
    console.log('Workflow Execution Log Status:', logPartial!.status)
    console.log('Action Results:')
    console.log(JSON.stringify(logPartial!.logs, null, 2))
  }

  // Cleanup
  await supabase.from('automation_workflows').delete().eq('id', wfA!.id)
  await supabase.from('automation_workflows').delete().eq('id', wfPartial!.id)
}

run().catch(console.error)
