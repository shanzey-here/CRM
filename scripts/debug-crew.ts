import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data: crewA } = await supabase.from('users').select('*').eq('email', 'crewa@example.com').single()
  if (!crewA) {
    console.log('No crew A found')
    return
  }
  
  const { data: assignments, error } = await supabase
    .from('job_crew_assignments')
    .select(`
      job_id,
      jobs!inner(
        id, status, move_date,
        contact:contacts(first_name, last_name)
      )
    `)
    .eq('user_id', crewA.id)
    
  console.log('Assignments:', JSON.stringify(assignments, null, 2))
  console.log('Error:', error)
}
run()
