import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await supabase.from('job_signoffs').select('*').limit(1)
  console.log('job_signoffs table accessible:', !error, error?.message)
  const { data: buckets } = await supabase.storage.listBuckets()
  console.log('Storage buckets:', JSON.stringify(buckets?.map(b => b.id)))
}
main().catch(e => { console.error(e); process.exit(1) })
