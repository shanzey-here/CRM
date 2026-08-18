import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const MY_TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
const OTHER_TENANT_ID = '33333333-3333-3333-3333-333333333333'

async function main() {
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: otherContact } = await serviceClient.from('contacts').select('id').eq('tenant_id', OTHER_TENANT_ID).limit(1).single()

  // Seed a genuinely clean draft invoice (0 payments) under the OTHER tenant, isolated to this test.
  const { data: invoice, error: invErr } = await serviceClient
    .from('invoices')
    .insert({
      tenant_id: OTHER_TENANT_ID,
      contact_id: otherContact!.id,
      job_id: null,
      invoice_number: 'INV-XTENANT-TEST-' + Date.now(),
      status: 'draft',
      subtotal: 500,
      tax_amount: 0,
      total: 500,
      issued_at: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()
  if (invErr) { console.error('Seed failed:', invErr.message); process.exit(1) }
  await serviceClient.from('invoice_line_items').insert({
    tenant_id: OTHER_TENANT_ID, invoice_id: invoice.id, description: 'Original item', quantity: 1, unit_price: 500, amount: 500, sort_order: 0,
  })
  console.log('Seeded clean other-tenant invoice (draft, 0 payments):', invoice.id)

  const { data: before } = await serviceClient.from('invoices').select('*').eq('id', invoice.id).single()
  console.log('BEFORE:', JSON.stringify(before))

  const authedClient = createClient(SUPABASE_URL, ANON_KEY)
  await authedClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  console.log('\nSigned in as admin@devtest.local — real tenant is', MY_TENANT_ID, '(NOT the invoice\'s tenant)')

  console.log('\n--- Spoofed p_tenant_id = invoice\'s real (other) tenant id ---')
  const r = await (authedClient as any).rpc('update_draft_invoice', {
    p_tenant_id: OTHER_TENANT_ID,
    p_invoice_id: invoice.id,
    p_notes: 'CROSS-TENANT ATTACK - clean target',
    p_line_items: [{ description: 'ATTACK ITEM', quantity: 1, unit_price: 1, sort_order: 0 }],
  })
  console.log('Result:', JSON.stringify({ data: r.data, error: r.error ? { message: r.error.message, code: r.error.code } : null }))

  const { data: after } = await serviceClient.from('invoices').select('*').eq('id', invoice.id).single()
  const { data: afterItems } = await serviceClient.from('invoice_line_items').select('*').eq('invoice_id', invoice.id)
  console.log('\nAFTER:', JSON.stringify(after))
  console.log('Line items AFTER:', JSON.stringify(afterItems))
  console.log('\nInvoice row unchanged:', JSON.stringify(before) === JSON.stringify(after))

  await serviceClient.from('invoice_line_items').delete().eq('invoice_id', invoice.id)
  await serviceClient.from('invoices').delete().eq('id', invoice.id)
  console.log('Cleaned up synthetic fixture.')
}
main()
