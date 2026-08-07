import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TENANT_ID = 'b181c2ad-20c5-4275-97fb-f6a5789e7bd5'
async function main() {
  const { data: sub } = await sc.from('tenant_subscriptions').select('*, saas_prices(saas_plans(name, entitlements))').eq('tenant_id', TENANT_ID).single()
  console.log('Existing subscription:', JSON.stringify(sub, null, 2))

  const { data: existingWf } = await sc.from('automation_workflows').select('*').eq('tenant_id', TENANT_ID)
  console.log('Existing workflows:', JSON.stringify(existingWf))
}
main()
