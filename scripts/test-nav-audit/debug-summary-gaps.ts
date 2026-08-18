import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  const { data: rawJob } = await sc.from('jobs').select('*').eq('id', jobId).single()
  console.log('Raw job row:', JSON.stringify(rawJob, null, 2))

  console.log('\n--- Testing the exact query my generator uses ---')
  const { data: job, error: jobError } = await sc
    .from('jobs')
    .select(`
      status, move_date, internal_notes, customer_notes, quote_id,
      contact:contacts(first_name, last_name, email, phone, company_name),
      origin_address:addresses!jobs_origin_address_fk(*),
      destination_address:addresses!jobs_destination_address_fk(*)
    `)
    .eq('id', jobId)
    .eq('tenant_id', rawJob!.tenant_id)
    .single()
  console.log('Query result:', JSON.stringify(job, null, 2))
  console.log('Query error:', jobError ? JSON.stringify(jobError) : '(none)')

  console.log('\n--- Testing the quote query ---')
  if (job?.quote_id) {
    const { data: quoteRow, error: quoteError } = await sc
      .from('quotes')
      .select('total_price, deposit_amount, total_volume, terms, quote_inventory(item_name, room, quantity, volume)')
      .eq('id', job.quote_id)
      .eq('tenant_id', rawJob!.tenant_id)
      .single()
    console.log('Quote result:', JSON.stringify(quoteRow, null, 2))
    console.log('Quote error:', quoteError ? JSON.stringify(quoteError) : '(none)')
  } else {
    console.log('job.quote_id is falsy:', job?.quote_id)
  }
}
main()
