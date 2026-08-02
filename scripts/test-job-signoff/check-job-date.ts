import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: job } = await supabase.from('jobs').select('id, move_date, status').eq('id', '5622fae6-4417-4beb-a446-bddddb740a41').single()
  console.log('Test job:', JSON.stringify(job))
  console.log('Today:', new Date().toISOString().slice(0, 10))
}
main().catch(e => { console.error(e); process.exit(1) })
