import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const jobId = '204844af-ad55-4d73-b91c-2188e0e587c6' // status: scheduled
  const crewUserId = '4b91ec16-a7b4-48b0-8ed2-479674e1a43e'

  const { data, error } = await sc.from('job_crew_assignments').insert({
    tenant_id: tenantId,
    job_id: jobId,
    user_id: crewUserId,
    assignment_role: 'porter',
    scheduled_start: '2026-08-10T09:00:00+00:00',
    scheduled_end: '2026-08-10T13:00:00+00:00',
  }).select().single()

  console.log('Seeded crew assignment:', JSON.stringify(data), error ? JSON.stringify(error) : '')
}
main()
