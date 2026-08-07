import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  const { data: job } = await sc.from('jobs').select('id, quote_id').eq('id', jobId).single()
  console.log('Job:', JSON.stringify(job))
  if (job?.quote_id) {
    const { data: quote } = await sc.from('quotes').select('*').eq('id', job.quote_id).single()
    console.log('Quote:', JSON.stringify(quote, null, 2))
    const { data: inv } = await sc.from('quote_inventory').select('*').eq('quote_id', job.quote_id)
    console.log('Quote inventory:', JSON.stringify(inv, null, 2))
  }
}
main()
