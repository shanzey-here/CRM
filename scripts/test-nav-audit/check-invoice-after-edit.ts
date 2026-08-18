import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const invoiceId = '51041c88-7b87-4f98-9a20-5d7c037f4de2'
  const { data: inv } = await sc.from('invoices').select('*').eq('id', invoiceId).single()
  console.log('Invoice after edit:', JSON.stringify(inv, null, 2))
  const { data: items } = await sc.from('invoice_line_items').select('*').eq('invoice_id', invoiceId).order('sort_order')
  console.log('Line items after edit:', JSON.stringify(items, null, 2))

  console.log('\n=== Quote isolation check ===')
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  const { data: job } = await sc.from('jobs').select('id, quote_id').eq('id', jobId).single()
  const { data: quote } = await sc.from('quotes').select('*').eq('id', job!.quote_id).single()
  console.log('Quote after invoice edit:', JSON.stringify(quote, null, 2))
  const { data: qinv } = await sc.from('quote_inventory').select('*').eq('quote_id', job!.quote_id)
  console.log('Quote inventory after invoice edit:', JSON.stringify(qinv, null, 2))
}
main()
