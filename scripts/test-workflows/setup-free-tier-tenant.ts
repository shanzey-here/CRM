import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ZERO_ENTITLEMENT_PRICE_ID = 'a0457aa6-8901-465c-9c51-c7325c84d6ec' // E2E Test Plan, entitlements: {}

async function main() {
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .insert([{ name: 'Free Tier Preview Test Co', slug: `free-tier-preview-${Date.now()}` }])
    .select()
    .single()
  if (tErr) throw tErr
  console.log('Tenant:', tenant!.id)

  const { data: created, error: uErr } = await supabase.auth.admin.createUser({
    email: 'admin-freetier@workflowtest.local',
    password: 'DevTest123!',
    email_confirm: true,
    app_metadata: { tenant_role: 'tenant_admin', tenant_id: tenant!.id },
  })
  if (uErr) { console.error('createUser error:', JSON.stringify(uErr)); throw uErr }
  console.log('Created auth user:', created.user!.id)

  const { error: userRowErr } = await supabase.from('users').insert({
    id: created.user!.id,
    tenant_id: tenant!.id,
    role: 'tenant_admin',
    full_name: 'Free Tier Admin',
    email: 'admin-freetier@workflowtest.local',
    is_active: true,
  })
  if (userRowErr) { console.error('users insert error:', JSON.stringify(userRowErr)); throw userRowErr }

  // A real, assigned subscription (non-null price_id) on a plan that genuinely lacks
  // automation_workflows — this is the actual scenario in scope, NOT the separate
  // out-of-scope {} entitlements-on-unassigned-trial gap.
  const { data: sub, error: sErr } = await supabase
    .from('tenant_subscriptions')
    .insert({
      tenant_id: tenant!.id,
      status: 'active',
      price_id: ZERO_ENTITLEMENT_PRICE_ID,
      stripe_subscription_id: 'sub_test_free_tier_' + Date.now(),
    })
    .select()
    .single()
  if (sErr) throw sErr
  console.log('Subscription:', JSON.stringify(sub))

  // Seed one pre-existing workflow directly (bypassing the app), to test that a free-tier
  // tenant's own already-saved workflow remains visible, not hidden.
  const { data: existingWorkflow, error: wErr } = await supabase
    .from('automation_workflows')
    .insert({
      tenant_id: tenant!.id,
      name: 'Pre-existing seeded workflow',
      is_active: false,
      trigger_event_type: 'lead.created',
      trigger_conditions: {},
    })
    .select()
    .single()
  if (wErr) throw wErr
  await supabase.from('automation_workflow_actions').insert({
    tenant_id: tenant!.id,
    workflow_id: existingWorkflow!.id,
    action_type: 'create_task',
    action_config: { title: 'Existing seeded task' },
    sort_order: 0,
  })
  console.log('Pre-existing workflow:', existingWorkflow!.id)

  console.log('\nFREE_TIER_TENANT_ID=' + tenant!.id)
  console.log('FREE_TIER_USER_ID=' + created.user!.id)
  console.log('FREE_TIER_WORKFLOW_ID=' + existingWorkflow!.id)
}
main()
