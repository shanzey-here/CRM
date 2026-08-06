import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  await sc.from('job_signoffs').delete().eq('job_id', jobId)
  const { data, error } = await sc.from('jobs').update({ status: 'scheduled', completion_summary: null, completion_summary_generated_at: null }).eq('id', jobId).select().single()
  console.log('Reset job:', JSON.stringify({ ...data, completion_summary: data?.completion_summary }), error ? JSON.stringify(error) : '')
}
main()
