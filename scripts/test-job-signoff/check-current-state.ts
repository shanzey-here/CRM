import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const jobId = '5622fae6-4417-4beb-a446-bddddb740a41'
  const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single()
  console.log('Real jobs row:', JSON.stringify({ id: job?.id, status: job?.status, updated_at: job?.updated_at }))

  const { data: signoffs } = await supabase.from('job_signoffs').select('*').eq('job_id', jobId).order('created_at', { ascending: false })
  console.log('Real job_signoffs rows (most recent first):', JSON.stringify(signoffs, null, 2))
}
main().catch(e => { console.error(e); process.exit(1) })
