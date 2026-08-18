import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id, id, email').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  console.log('Dev tenant:', tenantId)

  const { data: moduleOverride } = await sc.from('tenant_modules').select('*').eq('tenant_id', tenantId).eq('module_key', 'automation_workflows').maybeSingle()
  console.log('tenant_modules override for dev tenant:', JSON.stringify(moduleOverride))

  const { data: sub } = await sc.from('tenant_subscriptions').select('*, saas_prices(*, saas_plans(*))').eq('tenant_id', tenantId).maybeSingle()
  console.log('Dev tenant subscription:', JSON.stringify(sub, null, 2))

  const { data: existingWorkflows } = await sc.from('automation_workflows').select('id, name, is_active').eq('tenant_id', tenantId)
  console.log('Dev tenant existing workflows:', JSON.stringify(existingWorkflows))

  // Find any tenant with a real plan that grants automation_workflows = true
  const { data: plans } = await sc.from('saas_plans').select('id, name, entitlements')
  console.log('\nAll plans:', JSON.stringify(plans, null, 2))
}
main()
