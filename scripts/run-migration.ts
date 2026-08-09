
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Running migration...')
  const { error } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE public.leads ADD COLUMN estimated_hours numeric NULL, ADD COLUMN estimated_crew_size numeric NULL;' })
  if (error) {
    console.error('RPC failed, trying raw query via REST API... err:', error)
    // Supabase JS doesn't support raw queries directly easily without RPC.
    // So let's just make a fetch call.
  }
}
run().catch(console.error)

