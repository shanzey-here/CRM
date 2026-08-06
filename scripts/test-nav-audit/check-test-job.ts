import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: jobs } = await sc.from('jobs').select('id, status, quote_id, contact_id').eq('tenant_id', tenantId)
  console.log('Jobs:', JSON.stringify(jobs, null, 2))
}
main()
