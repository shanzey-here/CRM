import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const tenantId = '33333333-3333-3333-3333-333333333333'
  const { data: moduleOverride } = await sc.from('tenant_modules').select('*').eq('tenant_id', tenantId).eq('module_key', 'automation_workflows').maybeSingle()
  console.log('tenant_modules override:', JSON.stringify(moduleOverride))
  const { data: sub } = await sc.from('tenant_subscriptions').select('*, saas_prices(*, saas_plans(*))').eq('tenant_id', tenantId).maybeSingle()
  console.log('Subscription:', JSON.stringify(sub, null, 2))
  const { data: users } = await sc.from('users').select('id, email, tenant_role, is_active').eq('tenant_id', tenantId)
  console.log('Users:', JSON.stringify(users, null, 2))
  const { data: workflows } = await sc.from('automation_workflows').select('id, name, is_active').eq('tenant_id', tenantId)
  console.log('Existing workflows:', JSON.stringify(workflows))
}
main()
