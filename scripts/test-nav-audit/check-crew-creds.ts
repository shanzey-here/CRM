import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: crew } = await sc.from('users').select('email, tenant_role, tenant_id, is_active').eq('tenant_role', 'crew').eq('is_active', true)
  console.log('Real crew users:', JSON.stringify(crew, null, 2))

  // Check jobs assigned to the dev tenant crew member for the next 7 days, or any real job with a run sheet
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: jobs } = await sc.from('jobs').select('id, status, move_date, contact_id').eq('tenant_id', tenantId).order('move_date', { ascending: true })
  console.log('Real jobs for dev tenant:', JSON.stringify(jobs, null, 2))
}
main()
