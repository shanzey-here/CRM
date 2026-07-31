import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const TENANT_ID = process.argv[2]
const INVOICE_ID = process.argv[3]

async function main() {
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: 'customer@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  console.log('=== As customer session: read invoice_templates (expect RLS block if this is the bug) ===')
  const { data: template, error: templateErr } = await anonClient.from('invoice_templates').select('*').eq('tenant_id', TENANT_ID).single()
  console.log('Template:', template, 'error:', templateErr?.message)

  console.log('\n=== As customer session: read the invoice itself ===')
  const { data: invoice, error: invoiceErr } = await anonClient.from('invoices').select('*, invoice_line_items(*)').eq('tenant_id', TENANT_ID).eq('id', INVOICE_ID).single()
  console.log('Invoice:', invoice ? 'FOUND' : null, 'error:', invoiceErr?.message)

  console.log('\n=== As customer session: read tenant_settings ===')
  const { data: settings, error: settingsErr } = await anonClient.from('tenant_settings').select('*').eq('tenant_id', TENANT_ID).single()
  console.log('Settings:', settings ? 'FOUND' : null, 'error:', settingsErr?.message)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
