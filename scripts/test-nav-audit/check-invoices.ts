import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: invoices } = await sc.from('invoices').select('id, status, total, job_id, contact_id, quote_id:job_id').eq('tenant_id', tenantId)
  console.log('Invoices:', JSON.stringify(invoices, null, 2))
  for (const inv of invoices || []) {
    const { data: payments } = await sc.from('payments').select('id').eq('invoice_id', inv.id)
    console.log(`  Invoice ${inv.id} (${inv.status}): ${payments?.length || 0} payments`)
  }
}
main()
