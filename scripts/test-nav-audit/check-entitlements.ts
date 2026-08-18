import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id, email').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  console.log('Dev tenant (admin@devtest.local):', tenantId)

  const { data: modules } = await supabase.from('tenant_modules').select('module_key, enabled').eq('tenant_id', tenantId)
  console.log('tenant_modules rows:', JSON.stringify(modules, null, 2))

  const { data: sub } = await supabase
    .from('tenant_subscriptions')
    .select('status, saas_prices(saas_plans(name, entitlements))')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  console.log('Subscription + plan entitlements:', JSON.stringify(sub, null, 2))

  // List all tenants + their entitlement summary, to find a genuinely non-entitled one for a clean test
  const { data: allTenants } = await supabase.from('tenants').select('id, name').limit(20)
  console.log('\nSample of other tenants (for finding a non-entitled test candidate):', JSON.stringify(allTenants?.slice(0, 10), null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
