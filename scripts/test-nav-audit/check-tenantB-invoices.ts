import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  for (const tid of ['44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333']) {
    const { data: invoices } = await sc.from('invoices').select('id, status, total').eq('tenant_id', tid)
    console.log(`Tenant ${tid} invoices:`, JSON.stringify(invoices))
  }
}
main()
