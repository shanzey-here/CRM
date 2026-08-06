import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: tenants } = await sc.from('tenants').select('id, name').limit(10)
  console.log('Tenants:', JSON.stringify(tenants, null, 2))
  const { data: jobs } = await sc.from('jobs').select('id, tenant_id, status').neq('tenant_id', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1').limit(5)
  console.log('Jobs in OTHER tenants:', JSON.stringify(jobs, null, 2))
}
main()
