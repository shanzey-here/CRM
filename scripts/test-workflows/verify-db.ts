import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isWorkflowModuleEnabled } from '@/modules/workflows/server/repository'

async function run() {
  const supabase = createServiceRoleClient()

  const { data: tenants, error: tenantsErr } = await supabase.from('tenants').select('id').limit(2)
  if (tenantsErr) throw new Error(tenantsErr.message)
  const t1 = tenants![0].id
  const t2 = tenants![1].id

  // 1. Entitlement-gate test
  // Insert a mock plan for t1 with automation_workflows = true
  // Let's just create a fresh saas plan/price to avoid breaking existing data
  const planId = t1; // just reuse the UUID for convenience
  const priceId = t2;
  await supabase.from('saas_plans').upsert({ id: planId, name: 'Pro', is_active: true, entitlements: { automation_workflows: true } })
  await supabase.from('saas_prices').upsert({ id: priceId, saas_plan_id: planId, billing_interval: 'month', unit_amount: 5000, is_active: true, currency: 'usd' })
  
  await supabase.from('tenant_subscriptions').upsert({ tenant_id: t1, price_id: priceId, status: 'active', current_period_end: new Date().toISOString() })
  await supabase.from('tenant_modules').upsert({ tenant_id: t1, module_key: 'automation_workflows', enabled: true })

  const isEnabled1 = await isWorkflowModuleEnabled(supabase, t1)
  console.log(`[Entitlement] Tenant 1 workflows enabled? ${isEnabled1} (expected true)`)
  
  // ensure t2 is disabled
  await supabase.from('tenant_modules').upsert({ tenant_id: t2, module_key: 'automation_workflows', enabled: false })
  const isEnabled2 = await isWorkflowModuleEnabled(supabase, t2)
  console.log(`[Entitlement] Tenant 2 workflows enabled? ${isEnabled2} (expected false)`)

  // 2. Cross-tenant isolation
  // Insert a workflow for t1 using service role (bypasses RLS)
  const { data: w1, error: w1Error } = await supabase.from('automation_workflows').insert({
    tenant_id: t1,
    name: 'T1 Workflow',
    trigger_event_type: 'lead.created',
    is_active: true
  }).select('id').single()
  
  if (w1Error) {
    console.error('Failed to create w1:', w1Error)
  }

  // Verify T2 cannot see T1's workflow using RLS client
  // We'll mint a JWT for a fictional user in T2
  const dummyT2UserId = '22222222-2222-2222-2222-222222222222'
  const jwt = require('jsonwebtoken')
  const secret = process.env.SUPABASE_JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long'
  const token = jwt.sign({
    role: 'authenticated',
    aud: 'authenticated',
    sub: dummyT2UserId,
    app_metadata: { tenant_id: t2, role: 'tenant_admin' }
  }, secret)
  
  const { createClient } = require('@supabase/supabase-js')
  const t2Client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })
  
  const { data: seenWorkflows } = await t2Client.from('automation_workflows').select('*').eq('id', w1!.id)
  console.log(`[Isolation] Tenant 2 trying to read Tenant 1's workflow. Rows found: ${seenWorkflows?.length ?? 0} (expected 0)`)

  // 3. Negative test for trigger-event-type constraint
  console.log('[Constraint] Trying to insert a workflow with invalid trigger event type...')
  const { error: constraintErr } = await supabase.from('automation_workflows').insert({
    tenant_id: t1,
    name: 'Invalid Workflow',
    trigger_event_type: 'nonexistent.event' as any,
  })
  console.log(`[Constraint] Error received: ${constraintErr?.message ?? 'None'} (expected enum violation)`)
  
  // 4. Negative test for valid_update_lead_stage
  console.log('[Constraint] Trying to insert an action with invalid pipeline stage...')
  const { error: stageErr } = await supabase.from('automation_workflow_actions').insert({
    tenant_id: t1,
    workflow_id: w1!.id,
    action_type: 'update_lead_stage',
    action_config: { stage: 'some_invalid_stage_name' },
    sort_order: 1
  })
  console.log(`[Constraint] Error received: ${stageErr?.message ?? 'None'} (expected check constraint violation)`)

  console.log('--- DONE ---')
}

run().catch(console.error)
