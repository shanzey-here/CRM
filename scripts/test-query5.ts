
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, leads ( id, estimated_hours, estimated_crew_size )')
    .limit(1)
    
  if (error) {
    console.log('Query failed:', JSON.stringify(error, null, 2))
  } else {
    console.log('Query succeeded! Data:', data)
  }
}
run().catch(console.error)

