import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PRIMARY_CONTACT_ID = process.argv[2]
const CONTROL_CONTACT_ID = process.argv[3]

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function main() {
  const { error: signInErr } = await supabase.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  const { getContactRelocationHistory } = await import('../../src/modules/clients/server/repository')
  const { getRepeatCustomers, getContactLtv } = await import('../../src/modules/analytics/server/repository')

  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  console.log('=== Primary contact relocation history (real RLS-scoped session) ===')
  const primaryHistory = await getContactRelocationHistory(supabase as any, tenantId, PRIMARY_CONTACT_ID)
  console.log(JSON.stringify(primaryHistory, null, 2))

  console.log('\n=== get_repeat_customers() real output ===')
  const repeatCustomers = await getRepeatCustomers(supabase as any, tenantId)
  console.log(JSON.stringify(repeatCustomers, null, 2))
  console.log('Primary contact in repeat-customers list (expect true):', repeatCustomers.some((r) => r.contact_id === PRIMARY_CONTACT_ID))
  console.log('Control contact in repeat-customers list (expect false):', repeatCustomers.some((r) => r.contact_id === CONTROL_CONTACT_ID))

  console.log('\n=== get_contact_ltv() real output for primary contact (expect 3050.5) ===')
  const ltv = await getContactLtv(supabase as any, tenantId, PRIMARY_CONTACT_ID)
  console.log('LTV:', ltv)

  console.log('\n=== Control contact relocation history (expect 1 completed job, no cancelled/declined/expired) ===')
  const controlHistory = await getContactRelocationHistory(supabase as any, tenantId, CONTROL_CONTACT_ID)
  console.log(JSON.stringify(controlHistory, null, 2))
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
