import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const invoiceId = 'f44c83f8-93b1-456a-b65b-10d4b71b90de'
  const { error: pErr, count: pCount } = await sc.from('payments').delete({ count: 'exact' }).eq('invoice_id', invoiceId).eq('stripe_payment_intent_id', 'pi_test_seeded_guard_check')
  console.log('Deleted payments:', pCount, pErr?.message)
  const { error: sErr, count: sCount } = await sc.from('payment_schedules').delete({ count: 'exact' }).eq('invoice_id', invoiceId).eq('description', 'Test seeded deposit schedule')
  console.log('Deleted payment_schedules:', sCount, sErr?.message)
  const { data: remaining } = await sc.from('payments').select('id').eq('invoice_id', invoiceId)
  console.log('Remaining payments on invoice:', remaining?.length)
}
main()
