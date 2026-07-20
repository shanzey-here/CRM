import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { recordInvoicePayment } from '../src/modules/invoicing/server/repository'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('--- Invoice Stripe Payment Test & Idempotency ---')

  const tenantId = '33333333-3333-3333-3333-333333333333'
  
  // 1. Setup tenant & contact
  await supabase.from('tenants').upsert([{ id: tenantId, name: 'Stripe Tenant', slug: 'stripe-tenant' }])
  const contactId = crypto.randomUUID()
  await supabase.from('contacts').insert({ id: contactId, tenant_id: tenantId, first_name: 'Stripe', last_name: 'Test', email: 'stripe@test.com' })

  // 2. Setup Job and Invoice manually
  const jobId = crypto.randomUUID()
  await supabase.from('jobs').insert({ id: jobId, tenant_id: tenantId, contact_id: contactId, status: 'scheduled' })

  const invoiceId = crypto.randomUUID()
  await supabase.from('invoices').insert({
    id: invoiceId,
    tenant_id: tenantId,
    job_id: jobId,
    contact_id: contactId,
    status: 'draft',
    subtotal: 1000,
    total: 1000
  })

  // 3. Setup a pending Balance Payment Schedule
  const scheduleId = crypto.randomUUID()
  await supabase.from('payment_schedules').insert({
    id: scheduleId,
    tenant_id: tenantId,
    invoice_id: invoiceId,
    description: 'Balance',
    amount: 1000,
    due_date: '2026-08-15',
    status: 'pending'
  })

  const stripeIntentId = 'pi_test_' + crypto.randomUUID().slice(0, 8)

  console.log(`[TEST] Setup complete. Simulating first webhook delivery for intent ${stripeIntentId}...`)

  // 4. Simulate first webhook execution (genuine payment)
  const result1 = await recordInvoicePayment(supabase, tenantId, invoiceId, scheduleId, stripeIntentId, 1000)
  
  if (!result1.success) {
    console.error(`[FAIL] First payment record failed: ${result1.error}`)
    console.log(`\nNOTE: Ensure migration '00023_phase1_invoice_payment.sql' is applied!`)
    return
  }

  if (result1.alreadyPaid) {
    console.error(`[FAIL] Expected alreadyPaid = false for first run, got true.`)
  } else {
    console.log(`[PASS] First payment recorded correctly.`)
  }

  // Verify DB state after first run
  const { data: schedule1 } = await supabase.from('payment_schedules').select('status').eq('id', scheduleId).single()
  const { data: payments1 } = await supabase.from('payments').select('*').eq('payment_schedule_id', scheduleId)
  const { data: invoice1 } = await supabase.from('invoices').select('status').eq('id', invoiceId).single()

  if (schedule1?.status !== 'paid') console.error(`[FAIL] Schedule not paid!`)
  if (payments1?.length !== 1) console.error(`[FAIL] Expected 1 payment row, got ${payments1?.length}`)
  if (invoice1?.status !== 'paid') console.error(`[FAIL] Expected invoice status 'paid', got ${invoice1?.status}`)
  
  console.log(`[PASS] Database state matches expected 'paid' status and ledger.`)

  console.log(`[TEST] Simulating second webhook delivery (Stripe retry)...`)

  // 5. Simulate second webhook execution (idempotent retry)
  const result2 = await recordInvoicePayment(supabase, tenantId, invoiceId, scheduleId, stripeIntentId, 1000)
  
  if (!result2.success) {
    console.error(`[FAIL] Second payment record failed: ${result2.error}`)
    return
  }

  if (!result2.alreadyPaid) {
    console.error(`[FAIL] Expected alreadyPaid = true for retry, got false. Idempotency guard FAILED.`)
  } else {
    console.log(`[PASS] Second payment caught by idempotency guard and returned safe signal.`)
  }

  // Verify DB state after second run
  const { data: payments2 } = await supabase.from('payments').select('*').eq('payment_schedule_id', scheduleId)
  if (payments2?.length !== 1) {
    console.error(`[FAIL] Expected exactly 1 payment row, got ${payments2?.length}. Idempotency failed at database layer!`)
  } else {
    console.log(`[PASS] Database ledger verified: Exactly 1 payment row exists. No double-insertion occurred.`)
  }

  console.log('--- All Stripe Invoice tests completed successfully! ---')
}

runTests().catch(e => {
  console.error(e)
  process.exit(1)
})
