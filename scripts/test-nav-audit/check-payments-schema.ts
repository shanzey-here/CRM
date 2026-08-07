import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await sc.from('payments').select('*').limit(1)
  console.log('Sample real payment row:', JSON.stringify(data, null, 2))

  const invoiceId = 'f44c83f8-93b1-456a-b65b-10d4b71b90de'
  const { data: inv } = await sc.from('invoices').select('*').eq('id', invoiceId).single()
  console.log('\nSecondary draft invoice (candidate for seeding a payment):', JSON.stringify(inv, null, 2))
  const { data: items } = await sc.from('invoice_line_items').select('*').eq('invoice_id', invoiceId)
  console.log('Its line items:', JSON.stringify(items, null, 2))
}
main()
