import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const TEST_JOB_ID = '5622fae6-4417-4beb-a446-bddddb740a41'

async function main() {
  const { data: before } = await supabase.from('job_signoffs').select('id').eq('job_id', TEST_JOB_ID)
  console.log(`Found ${before?.length ?? 0} accumulated signoff rows for test job ${TEST_JOB_ID}`)

  const { error } = await supabase.from('job_signoffs').delete().eq('job_id', TEST_JOB_ID)
  if (error) throw error

  const { data: after } = await supabase.from('job_signoffs').select('id').eq('job_id', TEST_JOB_ID)
  console.log(`After scoped delete: ${after?.length ?? 0} rows remain for this job (expect 0)`)

  await supabase.from('jobs').update({ status: 'scheduled' }).eq('id', TEST_JOB_ID)
  console.log('Reset job status back to scheduled for a clean re-run.')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
