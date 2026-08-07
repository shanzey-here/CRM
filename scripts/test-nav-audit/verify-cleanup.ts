import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: race } = await sc.from('invoices').select('id').ilike('invoice_number', 'INV-RACE-TEST%')
  const { data: xtenant } = await sc.from('invoices').select('id').or('invoice_number.ilike.INV-XTENANT-TEST%,invoice_number.ilike.INV-SANITY%')
  console.log('Leftover race-test invoices:', race?.length)
  console.log('Leftover cross-tenant test invoices:', xtenant?.length)
  const { data: attackPayments } = await sc.from('payments').select('id, invoice_id').eq('stripe_payment_intent_id', 'pi_test_seeded_guard_check')
  console.log('Leftover seeded attack payments:', attackPayments?.length)
}
main()
