import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: leads } = await sc.from('leads').select('id, stage').eq('tenant_id', tenantId).limit(3)
  console.log('Sample leads:', JSON.stringify(leads))
  const { data: jobs } = await sc.from('jobs').select('id, status').eq('tenant_id', tenantId).limit(5)
  console.log('Sample jobs:', JSON.stringify(jobs))
  if (jobs && jobs.length) {
    const { data: crew } = await sc.from('job_crew_assignments').select('id, job_id, user_id').eq('tenant_id', tenantId).limit(5)
    console.log('Sample crew assignments:', JSON.stringify(crew))
  }
  const { data: staff } = await sc.from('users').select('id, email, role').eq('tenant_id', tenantId).in('role', ['tenant_admin','dispatcher'])
  console.log('Staff:', JSON.stringify(staff))
}
main()
