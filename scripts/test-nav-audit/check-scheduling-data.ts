import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: jobs } = await sc.from('jobs').select('id, status, move_date, contact_id').eq('tenant_id', tenantId).order('move_date', { ascending: true })
  console.log('Jobs:', JSON.stringify(jobs, null, 2))
  const { data: crewAssignments } = await sc.from('job_crew_assignments').select('job_id')
  const { data: vehicleAssignments } = await sc.from('job_vehicle_assignments').select('job_id')
  console.log('Jobs with crew assigned:', crewAssignments?.map(a => a.job_id))
  console.log('Jobs with vehicle assigned:', vehicleAssignments?.map(a => a.job_id))
}
main()
