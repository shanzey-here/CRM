import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  console.log('Dev tenant:', tenantId)

  const { data: moduleOverride } = await sc.from('tenant_modules').select('*').eq('tenant_id', tenantId).eq('module_key', 'analytics').maybeSingle()
  console.log('tenant_modules analytics override:', JSON.stringify(moduleOverride))

  const { data: sub } = await sc.from('tenant_subscriptions').select('*, saas_prices(*, saas_plans(*))').eq('tenant_id', tenantId).maybeSingle()
  console.log('Subscription plan entitlements:', JSON.stringify((sub as any)?.saas_prices?.saas_plans?.entitlements))

  // Real data check: how many leads/quotes/jobs exist for this tenant (for funnel + repeat customers)
  const { count: leadCount } = await sc.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const { count: completedJobs } = await sc.from('jobs').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'completed')
  console.log('Real leads count:', leadCount, '| Real completed jobs:', completedJobs)
}
main()
