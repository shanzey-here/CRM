import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env', override: true })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('--- RPC VERIFICATION ---')

  const { data: tenants } = await supabase.from('tenants').select('id').limit(2)
  const t1 = tenants![0].id

  // 1. Create Workflow via RPC
  console.log('\n[1] Creating workflow with 2 actions...')
  const payload = {
    p_tenant_id: t1,
    p_workflow_id: null,
    p_name: 'Test RPC Workflow',
    p_is_active: true,
    p_trigger_event_type: 'lead.created',
    p_trigger_conditions: { source: 'website' },
    p_actions: [
      { action_type: 'create_task', action_config: { title: 'First Task' }, sort_order: 0 },
      { action_type: 'update_lead_stage', action_config: { stage: 'follow_up' }, sort_order: 1 }
    ]
  }

  const { data: result1, error: error1 } = await supabase.rpc('save_workflow_transaction', payload)
  if (error1) {
    console.error('RPC Error:', error1)
    return
  }
  
  const workflowId = result1.id
  console.log('Success. Workflow ID:', workflowId)

  // Verify rows
  const { data: fetch1 } = await supabase
    .from('automation_workflows')
    .select('name, is_active, trigger_event_type, trigger_conditions, automation_workflow_actions(action_type, sort_order, action_config)')
    .eq('id', workflowId)
    .single()
  
  console.log('Saved Workflow:', JSON.stringify(fetch1, null, 2))

  // 2. Edit Workflow via RPC (Update)
  console.log('\n[2] Editing workflow (changing name, removing task, adding new task)...')
  const editPayload = {
    p_tenant_id: t1,
    p_workflow_id: workflowId,
    p_name: 'Test RPC Workflow (Edited)',
    p_is_active: false,
    p_trigger_event_type: 'email.received',
    p_trigger_conditions: {},
    p_actions: [
      { action_type: 'update_lead_stage', action_config: { stage: 'quote_sent' }, sort_order: 0 }
    ]
  }

  const { error: error2 } = await supabase.rpc('save_workflow_transaction', editPayload)
  if (error2) {
    console.error('RPC Error on edit:', error2)
    return
  }
  
  const { data: fetch2 } = await supabase
    .from('automation_workflows')
    .select('name, is_active, trigger_event_type, trigger_conditions, automation_workflow_actions(action_type, sort_order, action_config)')
    .eq('id', workflowId)
    .single()
  
  console.log('Edited Workflow:', JSON.stringify(fetch2, null, 2))

  console.log('\n--- DONE ---')
}

run().catch(console.error)
