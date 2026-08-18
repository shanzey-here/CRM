import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await sc.from('jobs').select('id, completion_summary, completion_summary_generated_at').limit(2)
  console.log('Sample:', JSON.stringify(data))
  console.log('Error:', error ? JSON.stringify(error) : '(none)')
}
main()
