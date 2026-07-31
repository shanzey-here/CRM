import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const TENANT_ID = process.argv[2]
const INVOICE_ZERO_ID = process.argv[3]
const INVOICE_MULTI_ID = process.argv[4]

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('========== 1. No-mutation check: real invoice/line-item rows after the template edit ==========')
  const { data: zeroInvoice } = await serviceClient.from('invoices').select('*').eq('id', INVOICE_ZERO_ID).single()
  console.log('Zero-line invoice (expect subtotal=0, tax_amount=0, total=0, unchanged):', JSON.stringify({ subtotal: zeroInvoice!.subtotal, tax_amount: zeroInvoice!.tax_amount, total: zeroInvoice!.total, status: zeroInvoice!.status }))

  const { data: multiInvoice } = await serviceClient.from('invoices').select('*').eq('id', INVOICE_MULTI_ID).single()
  console.log('Multi-line invoice (expect subtotal=975.5, tax_amount=195.1, total=1170.6, unchanged):', JSON.stringify({ subtotal: multiInvoice!.subtotal, tax_amount: multiInvoice!.tax_amount, total: multiInvoice!.total, status: multiInvoice!.status }))
  console.log(
    'Multi-line invoice figures byte-identical to what setup-fixtures.ts wrote:',
    multiInvoice!.subtotal === 975.5 && multiInvoice!.tax_amount === 195.1 && multiInvoice!.total === 1170.6
  )

  const { data: lineItems } = await serviceClient.from('invoice_line_items').select('*').eq('invoice_id', INVOICE_MULTI_ID).order('sort_order')
  console.log('\nLine items still exactly as seeded (3 rows, real amounts):', JSON.stringify(lineItems!.map((l) => ({ description: l.description, quantity: l.quantity, unit_price: l.unit_price, amount: l.amount })), null, 2))
  const expectedAmounts = [780, 76.5, 119]
  console.log('Amounts match exactly:', JSON.stringify(lineItems!.map((l) => l.amount)) === JSON.stringify(expectedAmounts))

  console.log('\n========== 2. Cross-tenant isolation on /customer/invoices/[id] ==========')
  const { data: tenantB } = await serviceClient
    .from('tenants')
    .insert([{ name: 'Tenant B Invoice Editor UI Test', slug: `tenant-b-invoice-ui-${Date.now()}` }])
    .select()
    .single()

  const authResult = await serviceClient.auth.admin.createUser({
    email: `tenant-b-customer-${Date.now()}@example.com`,
    password: 'DevTest123!',
    email_confirm: true,
    app_metadata: { tenant_id: tenantB!.id, tenant_role: 'customer' },
  })
  if (authResult.error || !authResult.data.user) {
    console.error('createUser failed:', JSON.stringify(authResult.error))
    throw authResult.error
  }
  const tenantBUserId = authResult.data.user.id
  const tenantBEmail = authResult.data.user.email!

  // contacts.user_id has a composite FK to users(id, tenant_id) — a matching
  // row in the app's own users table is required, not just an auth.users entry.
  const { error: userInsertErr } = await serviceClient
    .from('users')
    .insert({ id: tenantBUserId, tenant_id: tenantB!.id, email: tenantBEmail, role: 'customer', full_name: 'Tenant B Customer' })
  if (userInsertErr) {
    console.error('users insert failed:', JSON.stringify(userInsertErr))
    throw userInsertErr
  }

  const { data: contactB, error: contactBErr } = await serviceClient
    .from('contacts')
    .insert({ tenant_id: tenantB!.id, first_name: 'TenantB', last_name: 'Customer', user_id: tenantBUserId, type: 'residential' })
    .select()
    .single()
  if (contactBErr || !contactB) {
    console.error('contacts insert failed:', JSON.stringify(contactBErr))
    throw contactBErr
  }

  const { data: invoiceB, error: invoiceBErr } = await serviceClient
    .from('invoices')
    .insert({ tenant_id: tenantB!.id, contact_id: contactB.id, invoice_number: 'INV-TENANTB', status: 'sent', subtotal: 5000, tax_amount: 1000, total: 6000 })
    .select()
    .single()
  if (invoiceBErr || !invoiceB) {
    console.error('invoices insert failed:', JSON.stringify(invoiceBErr))
    throw invoiceBErr
  }
  console.log('Tenant B customer:', tenantBEmail, 'contact:', contactB.id, 'invoice:', invoiceB.id)

  // Tenant A's customer session attempting to read Tenant B's real invoice id directly
  const tenantAClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await tenantAClient.auth.signInWithPassword({ email: 'customer@devtest.local', password: 'DevTest123!' })

  const { getInvoiceRenderData } = await import('../../src/modules/invoicing/server/render-data')
  const result = await getInvoiceRenderData(tenantAClient as any, TENANT_ID, invoiceB!.id)
  console.log('\nTenant A customer session fetching Tenant B invoice id directly (must fail):', JSON.stringify({ success: result.success, error: result.error }))

  const { data: directRead, error: directErr } = await tenantAClient.from('invoices').select('*').eq('id', invoiceB!.id).maybeSingle()
  console.log('Direct RLS-scoped read of Tenant B invoice by real id (must be null):', directRead, 'error:', directErr?.message)

  // Cleanup
  await serviceClient.from('invoices').delete().eq('id', invoiceB!.id)
  await serviceClient.from('contacts').delete().eq('id', contactB!.id)
  await serviceClient.auth.admin.deleteUser(tenantBUserId)
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nTenant B cleanup complete.')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
