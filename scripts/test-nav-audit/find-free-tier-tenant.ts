import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  // Find real, assigned subscriptions (price_id NOT null) whose plan entitlements don't include automation_workflows
  const { data: subs } = await sc
    .from('tenant_subscriptions')
    .select('tenant_id, status, price_id, saas_prices(saas_plans(name, entitlements))')
    .not('price_id', 'is', null)
  for (const s of subs || []) {
    const ent = (s as any).saas_prices?.saas_plans?.entitlements
    if (!ent || ent.automation_workflows !== true) {
      console.log('Candidate free-tier tenant:', s.tenant_id, 'plan:', (s as any).saas_prices?.saas_plans?.name, 'entitlements:', JSON.stringify(ent), 'status:', s.status)
    }
  }
}
main()
