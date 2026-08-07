import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TENANT_ID = 'b181c2ad-20c5-4275-97fb-f6a5789e7bd5'
const ZERO_ENTITLEMENT_PRICE_ID = 'a0457aa6-8901-465c-9c51-c7325c84d6ec'

async function main() {
  const { data: sub, error: sErr } = await sc
    .from('tenant_subscriptions')
    .insert({
      tenant_id: TENANT_ID,
      status: 'active',
      price_id: ZERO_ENTITLEMENT_PRICE_ID,
      stripe_subscription_id: 'sub_test_free_tier_' + Date.now(),
    })
    .select()
    .single()
  if (sErr) { console.error('subscription insert error:', JSON.stringify(sErr, null, 2)); process.exit(1) }
  console.log('Subscription created:', JSON.stringify(sub))

  const { data: existingWorkflow, error: wErr } = await sc
    .from('automation_workflows')
    .insert({
      tenant_id: TENANT_ID,
      name: 'Pre-existing seeded workflow',
      is_active: false,
      trigger_event_type: 'lead.created',
      trigger_conditions: {},
    })
    .select()
    .single()
  if (wErr) { console.error('workflow insert error:', JSON.stringify(wErr, null, 2)); process.exit(1) }
  console.log('Pre-existing workflow created:', existingWorkflow!.id)

  const { error: actionErr } = await sc.from('automation_workflow_actions').insert({
    tenant_id: TENANT_ID,
    workflow_id: existingWorkflow!.id,
    action_type: 'create_task',
    action_config: { title: 'Existing seeded task' },
    sort_order: 0,
  })
  if (actionErr) { console.error('action insert error:', JSON.stringify(actionErr, null, 2)); process.exit(1) }

  console.log('\nFREE_TIER_TENANT_ID=' + TENANT_ID)
  console.log('FREE_TIER_WORKFLOW_ID=' + existingWorkflow!.id)
}
main()
