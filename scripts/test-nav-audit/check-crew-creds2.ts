import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: allUsers } = await sc.from('users').select('email, role, tenant_id, is_active')
  console.log('All users with role column:', JSON.stringify(allUsers, null, 2))

  const { data: crewAssignment } = await sc.from('job_crew_assignments').select('*').eq('job_id', '204844af-ad55-4d73-b91c-2188e0e587c6')
  console.log('Crew assignments for scheduled job:', JSON.stringify(crewAssignment))
}
main()
