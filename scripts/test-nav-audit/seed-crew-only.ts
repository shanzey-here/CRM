import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  const crewUserId = '4b91ec16-a7b4-48b0-8ed2-479674e1a43e'

  const { data: crew, error: crewErr } = await sc.from('job_crew_assignments').insert({
    tenant_id: tenantId,
    job_id: jobId,
    user_id: crewUserId,
    assignment_role: 'lead_crew',
    scheduled_start: '2026-08-11T09:00:00+00:00',
    scheduled_end: '2026-08-11T13:00:00+00:00',
    actual_start: '2026-08-11T09:20:00+00:00',
    actual_end: '2026-08-11T14:10:00+00:00',
  }).select().single()
  console.log('Seeded crew assignment:', JSON.stringify(crew), crewErr ? JSON.stringify(crewErr) : '')
}
main()
