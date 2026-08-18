import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const crewA = users.find(u => u.email === 'crewa@example.com')
  console.log('crewa@example.com auth user:', crewA ? crewA.id : 'NOT FOUND')
  if (crewA) {
    const { data: userRow } = await supabase.from('users').select('*').eq('id', crewA.id).single()
    console.log('users row:', JSON.stringify(userRow))
    const { data: assignments } = await supabase.from('job_crew_assignments').select('job_id, created_at').eq('user_id', crewA.id).order('created_at', { ascending: false }).limit(3)
    console.log('Recent job assignments:', JSON.stringify(assignments))
  }
}
main().catch(e => { console.error(e); process.exit(1) })
