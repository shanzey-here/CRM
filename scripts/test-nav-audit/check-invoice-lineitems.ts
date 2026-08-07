import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const invoiceId = '51041c88-7b87-4f98-9a20-5d7c037f4de2'
  const { data: inv } = await sc.from('invoices').select('*').eq('id', invoiceId).single()
  console.log('Invoice:', JSON.stringify(inv, null, 2))
  const { data: items } = await sc.from('invoice_line_items').select('*').eq('invoice_id', invoiceId)
  console.log('Line items:', JSON.stringify(items, null, 2))
}
main()
