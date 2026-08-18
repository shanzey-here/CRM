import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  // Find real tenants with a real assigned plan (non-null price_id) whose plan lacks 'analytics'
  const { data: subs } = await sc
    .from('tenant_subscriptions')
    .select('tenant_id, status, price_id, saas_prices(saas_plans(name, entitlements))')
    .not('price_id', 'is', null)
  for (const s of subs || []) {
    const ent = (s as any).saas_prices?.saas_plans?.entitlements
    if (!ent || ent.analytics !== true) {
      const { data: override } = await sc.from('tenant_modules').select('enabled').eq('tenant_id', s.tenant_id).eq('module_key', 'analytics').maybeSingle()
      if (!override?.enabled) {
        console.log('Candidate unentitled tenant:', s.tenant_id, 'plan:', (s as any).saas_prices?.saas_plans?.name)
        const { data: users } = await sc.from('users').select('email, tenant_role, is_active').eq('tenant_id', s.tenant_id).eq('is_active', true)
        console.log('  Real active users:', JSON.stringify(users))
      }
    }
  }
}
main()
