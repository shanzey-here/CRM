import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: customerUser } = await supabase.from('users').select('id').eq('email', 'customer@devtest.local').single()
  const { data: contact } = await supabase.from('contacts').select('id').eq('tenant_id', tenantId).eq('user_id', customerUser!.id).single()
  console.log('Using tenant:', tenantId, 'contact:', contact!.id)

  // Fuller branding for a meaningful header/terms render
  await supabase
    .from('tenant_settings')
    .update({
      company_legal_name: 'Gomove Removals Ltd',
      terms_template: 'Payment is due within 14 days of the invoice date. Late payments may incur a 5% surcharge.',
      address_line_1: '221B Baker Street',
      address_city: 'London',
      address_postcode: 'NW1 6XE',
      vat_number: 'GB123456789',
    })
    .eq('tenant_id', tenantId)
  console.log('Branding updated for a fuller render.')

  // Invoice A: ZERO line items
  const { data: invoiceZero } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      contact_id: contact!.id,
      invoice_number: `INV-ZERO-${Date.now()}`,
      status: 'draft',
      subtotal: 0,
      tax_amount: 0,
      total: 0,
      issued_at: '2026-07-25',
      due_date: '2026-08-08',
    })
    .select()
    .single()
  console.log('Zero-line-item invoice:', invoiceZero!.id)

  // Invoice B: MULTIPLE line items, real distinct figures
  const { data: invoiceMulti } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      contact_id: contact!.id,
      invoice_number: `INV-MULTI-${Date.now()}`,
      status: 'sent',
      subtotal: 975.5,
      tax_amount: 195.1,
      total: 1170.6,
      issued_at: '2026-07-20',
      due_date: '2026-08-03',
    })
    .select()
    .single()
  console.log('Multi-line-item invoice:', invoiceMulti!.id)

  const { data: lineItems } = await supabase
    .from('invoice_line_items')
    .insert([
      { tenant_id: tenantId, invoice_id: invoiceMulti!.id, description: 'Removals service — 4 bedroom house', quantity: 1, unit_price: 780.0, amount: 780.0, sort_order: 0 },
      { tenant_id: tenantId, invoice_id: invoiceMulti!.id, description: 'Packing materials', quantity: 3, unit_price: 25.5, amount: 76.5, sort_order: 1 },
      { tenant_id: tenantId, invoice_id: invoiceMulti!.id, description: 'Piano handling surcharge', quantity: 1, unit_price: 119.0, amount: 119.0, sort_order: 2 },
    ])
    .select()
  console.log('Line items:', JSON.stringify(lineItems, null, 2))

  console.log('\n=== FIXTURE IDS ===')
  console.log('TENANT_ID=' + tenantId)
  console.log('CONTACT_ID=' + contact!.id)
  console.log('INVOICE_ZERO_ID=' + invoiceZero!.id)
  console.log('INVOICE_MULTI_ID=' + invoiceMulti!.id)
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
