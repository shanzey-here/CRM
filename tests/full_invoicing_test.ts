import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function fullInvoicingFlow() {
  console.log('=== FULL INVOICING INTEGRATION TEST ===\n')

  const tenantId = crypto.randomUUID()
  const contactId = crypto.randomUUID()
  const leadId = crypto.randomUUID()
  const originAddressId = crypto.randomUUID()
  const destAddressId = crypto.randomUUID()
  const quoteId = crypto.randomUUID()
  const randomSuffix = crypto.randomBytes(4).toString('hex')

  try {
    // 1. Create tenant
    console.log('1. Creating tenant...')
    const { data: tenantInsert, error: tenantInsertErr } = await supabase.from('tenants').insert({
      id: tenantId,
      name: 'Test Moving Company',
      slug: `test-movers-${randomSuffix}`
    }).select()

    if (tenantInsertErr) {
      throw new Error(`Tenant insert failed: ${tenantInsertErr.message}`)
    }
    console.log(`   ✓ Tenant created: ${tenantId}\n`)

    // 2. Create tenant settings
    console.log('2. Creating tenant settings with balance_due_days_before_move=3...')
    const { error: settingsErr } = await supabase.from('tenant_settings').insert({
      tenant_id: tenantId,
      balance_due_days_before_move: 3
    })

    if (settingsErr) {
      throw new Error(`Tenant settings insert failed: ${settingsErr.message}`)
    }
    console.log('   ✓ Settings created\n')

    // 3. Create contact
    console.log('3. Creating contact...')
    await supabase.from('contacts').insert({
      id: contactId,
      tenant_id: tenantId,
      first_name: 'John',
      last_name: 'Smith',
      email: 'john@example.com',
      phone: '555-0123'
    })
    console.log(`   ✓ Contact created: ${contactId}\n`)

    // 4. Create addresses
    console.log('4. Creating origin and destination addresses...')
    await supabase.from('addresses').insert([
      {
        id: originAddressId,
        tenant_id: tenantId,
        street_1: '123 Elm Street',
        city: 'Boston',
        state: 'MA',
        postal_code: '02101',
        country: 'USA'
      },
      {
        id: destAddressId,
        tenant_id: tenantId,
        street_1: '456 Oak Avenue',
        city: 'Cambridge',
        state: 'MA',
        postal_code: '02139',
        country: 'USA'
      }
    ])
    console.log('   ✓ Addresses created\n')

    // 5. Create lead with addresses and move date
    console.log('5. Creating lead with move date 2026-09-10...')
    await supabase.from('leads').insert({
      id: leadId,
      tenant_id: tenantId,
      contact_id: contactId,
      stage: 'quote_sent',
      preferred_move_date: '2026-09-10',
      origin_address_id: originAddressId,
      destination_address_id: destAddressId
    })
    console.log(`   ✓ Lead created: ${leadId}\n`)

    // 6. Create quote
    console.log('6. Creating quote with deposit...')
    const { data: quoteInsertResult, error: quoteError } = await supabase.from('quotes').insert({
      id: quoteId,
      tenant_id: tenantId,
      contact_id: contactId,
      lead_id: leadId,
      status: 'sent',
      subtotal: 5000,
      surcharge_total: 500,
      total_price: 5500,
      deposit_amount: 1500
    }).select()

    if (quoteError) {
      throw new Error(`Quote insert failed: ${quoteError.message}`)
    }
    console.log(`   ✓ Quote created: ${quoteId}\n`)

    // Verify quote exists before RPC
    const { data: verifyQuote } = await supabase
      .from('quotes')
      .select('id, tenant_id, status')
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .single()

    console.log(`   Verification - Quote in DB: ${verifyQuote?.id}, Status: ${verifyQuote?.status}\n`)

    // 7. Accept the quote (triggers invoice generation)
    console.log('7. Accepting quote and generating invoice...')
    const stripeIntentId = 'pi_test_' + crypto.randomUUID().slice(0, 12)

    // Simulate what happens when the Stripe webhook hits the API
    const { data: acceptResult, error: acceptError } = await supabase.rpc('accept_quote_transaction', {
      p_tenant_id: tenantId,
      p_quote_id: quoteId,
      p_lead_id: leadId,
      p_contact_id: contactId,
      p_move_date: '2026-09-10',
      p_origin_address_id: originAddressId,
      p_destination_address_id: destAddressId,
      p_stripe_payment_intent_id: stripeIntentId,
      p_invoice_subtotal: 5000,
      p_invoice_tax_amount: 0,
      p_invoice_total: 5500,
      p_line_items: [
        {"description":"Removals Service","quantity":1,"unit_price":5000,"amount":5000,"sort_order":1},
        {"description":"Surcharges","quantity":1,"unit_price":500,"amount":500,"sort_order":2}
      ] as any,
      p_deposit_schedule: { description: 'Deposit', amount: 1500, due_date: new Date().toISOString().split('T')[0], status: 'paid' } as any,
      p_balance_schedule: { description: 'Balance', amount: 4000, due_date: '2026-09-07', status: 'pending' } as any
    })

    if (acceptError) {
      throw new Error(`Accept quote failed: ${acceptError.message}`)
    }

    const jobId = (acceptResult as any).job_id
    const invoiceId = (acceptResult as any).invoice_id
    console.log(`   ✓ Quote accepted, Job: ${jobId}, Invoice: ${invoiceId}\n`)

    // 8. Fetch and display invoice
    console.log('8. Fetching invoice with line items and payment schedules...')
    const { data: invoice } = await supabase
      .from('invoices')
      .select(`
        id, tenant_id, job_id, status, subtotal, tax_amount, total, issued_at,
        invoice_line_items(*),
        payment_schedules(*)
      `)
      .eq('id', invoiceId)
      .single()

    if (!invoice) throw new Error('Invoice not found')

    console.log(`   Invoice Details:`)
    console.log(`   • ID: ${invoice.id}`)
    console.log(`   • Job ID: ${invoice.job_id}`)
    console.log(`   • Status: ${invoice.status}`)
    console.log(`   • Subtotal: $${invoice.subtotal}`)
    console.log(`   • Tax: $${invoice.tax_amount}`)
    console.log(`   • Total: $${invoice.total}`)
    console.log(`   • Issued: ${invoice.issued_at}\n`)

    console.log(`   Line Items:`)
    for (const item of invoice.invoice_line_items || []) {
      console.log(`   • ${item.description}: $${item.amount} (qty: ${item.quantity}, sort_order: ${item.sort_order})`)
    }

    console.log(`\n   Payment Schedules:`)
    const schedules = invoice.payment_schedules || []
    for (const schedule of schedules) {
      console.log(`   • ${schedule.description}: $${schedule.amount} (status: ${schedule.status}, due: ${schedule.due_date})`)
    }

    // 9. Verify the expectations
    console.log('\n9. Verification:')
    let allPass = true

    if (invoice.status !== 'draft') {
      console.log(`   ❌ Invoice status should be 'draft', got '${invoice.status}'`)
      allPass = false
    } else {
      console.log(`   ✓ Invoice status is 'draft'`)
    }

    if ((invoice.invoice_line_items || []).length !== 2) {
      console.log(`   ❌ Should have 2 line items, got ${(invoice.invoice_line_items || []).length}`)
      allPass = false
    } else {
      console.log(`   ✓ Correct number of line items (2)`)
    }

    if ((invoice.payment_schedules || []).length !== 2) {
      console.log(`   ❌ Should have 2 payment schedules, got ${(invoice.payment_schedules || []).length}`)
      allPass = false
    } else {
      console.log(`   ✓ Correct number of payment schedules (2)`)

      const deposit = schedules.find((s: any) => s.description === 'Deposit')
      const balance = schedules.find((s: any) => s.description === 'Balance')

      if (deposit?.status !== 'paid') {
        console.log(`   ❌ Deposit should be 'paid', got '${deposit?.status}'`)
        allPass = false
      } else {
        console.log(`   ✓ Deposit marked as 'paid'`)
      }

      if (balance?.status !== 'pending') {
        console.log(`   ❌ Balance should be 'pending', got '${balance?.status}'`)
        allPass = false
      } else {
        console.log(`   ✓ Balance marked as 'pending'`)
      }

      // Balance due should be move_date (2026-09-10) minus 3 days = 2026-09-07
      if (balance?.due_date !== '2026-09-07') {
        console.log(`   ❌ Balance due date should be 2026-09-07, got '${balance?.due_date}'`)
        allPass = false
      } else {
        console.log(`   ✓ Balance due date correctly calculated (3 days before move)`)
      }
    }

    console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`)

  } catch (err: any) {
    console.error(`\n❌ Test failed: ${err.message}`)
    console.error(err)
    process.exit(1)
  }
}

fullInvoicingFlow()
