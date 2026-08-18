import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  const { data: job } = await sc.from('jobs').select('id, status, completion_summary, completion_summary_generated_at').eq('id', jobId).single()
  console.log('Job:', JSON.stringify({ ...job, completion_summary: job?.completion_summary ? '(present)' : null }))
  const { data: signoffs } = await sc.from('job_signoffs').select('*').eq('job_id', jobId)
  console.log('Signoffs:', JSON.stringify(signoffs))
}
main()
