import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import fs from 'fs'
config({ path: '.env.local' })

async function run() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const sql = fs.readFileSync('supabase/migrations/00054_phase2_ai_email_draft.sql', 'utf8')

  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql })
  if (error) {
    console.error('Failed via RPC (exec_sql might not exist):', error.message)
  } else {
    console.log('SQL applied successfully via RPC!', data)
  }
}
run()
