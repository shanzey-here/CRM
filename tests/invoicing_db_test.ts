import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { markQuoteAccepted } from '../src/modules/quotes/server/repository'
import { getInvoicesByJob } from '../src/modules/invoicing/server/repository'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('--- Invoicing Database & Split Billing Test ---')

  // NOTE: This test requires the `00019_phase1_invoicing_db.sql` migration to be applied manually
  // on the remote staging database if `supabase db reset` cannot be run locally via Docker.

  const tenantId = '33333333-3333-3333-3333-333333333333'
  
  // 1. Setup tenant & settings if missing
  await supabase.from('tenants').upsert([{ id: tenantId, name: 'Invoicing Tenant', slug: 'invoicing-tenant' }])
  await supabase.from('tenant_settings').upsert([{ tenant_id: tenantId, balance_due_days_before_move: 2 }])

  // 2. Setup contact
  const contactId = crypto.randomUUID()
  const contactInsert = await supabase.from('contacts').insert({
    id: contactId,
    tenant_id: tenantId,
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane.invoice@test.com'
  })
  if (contactInsert.error) {
    console.error('Contact insert error:', contactInsert.error.message)
  }

  // 3. Create Lead
  const leadId = crypto.randomUUID()
  const leadInsert = await supabase.from('leads').insert({
    id: leadId,
    tenant_id: tenantId,
    contact_id: contactId,
    stage: 'quote_sent',
    preferred_move_date: '2026-08-15'
  })
  if (leadInsert.error) {
    console.error('Lead insert error:', leadInsert.error.message)
  }

  // 4. Create Quote (Sent status) with deposit
  const quoteId = crypto.randomUUID()
  const quoteInsert = await supabase.from('quotes').insert({
    id: quoteId,
    tenant_id: tenantId,
    lead_id: leadId,
    contact_id: contactId,
    status: 'sent',
    subtotal: 1000,
    surcharge_total: 200,
    total_price: 1200,
    deposit_amount: 200
  })
  if (quoteInsert.error) {
    console.error('Quote insert error:', quoteInsert.error.message)
  }

  console.log(`[TEST] Setup complete. Quote ${quoteId} is in 'sent' state.`)

  // 5. Simulate Stripe webhook accepting the quote
  const fakeStripeIntentId = 'pi_test_' + crypto.randomUUID().slice(0, 8)
  console.log(`[TEST] Calling markQuoteAccepted with Stripe Intent: ${fakeStripeIntentId}`)

  const acceptResult = await markQuoteAccepted(supabase, tenantId, quoteId, fakeStripeIntentId)
  
  // If the migration isn't applied yet, this will fail with 'function accept_quote_transaction... does not exist' 
  // or arity mismatch. We handle this gracefully.
  if (!acceptResult.success) {
    console.error(`[FAIL] markQuoteAccepted failed: ${acceptResult.error}`)
    console.log(`\nNOTE: If the error mentions missing RPC or arguments, please ensure 'supabase/migrations/00019_phase1_invoicing_db.sql' is executed on the database!`)
    return
  }

  const jobId = acceptResult.jobId
  console.log(`[PASS] Job created: ${jobId}`)

  // 6. Verify Invoice and Split Billing via Repository
  const { data: invoices, error: invErr } = await getInvoicesByJob(supabase, tenantId, jobId)
  
  if (invErr) {
    console.error(`[FAIL] Failed to fetch invoices: ${invErr}`)
    return
  }

  if (!invoices || invoices.length === 0) {
    console.error(`[FAIL] No invoice was generated for job ${jobId}`)
    return
  }

  const invoice = invoices[0]
  console.log(`[PASS] Invoice generated: ${invoice.id} (Total: ${invoice.total})`)

  if (invoice.status !== 'draft') {
    console.error(`[FAIL] Expected invoice status 'draft', got '${invoice.status}'`)
  }

  if (invoice.lineItems.length !== 2) {
    console.error(`[FAIL] Expected 2 line items (Service + Surcharge), got ${invoice.lineItems.length}`)
  } else {
    console.log(`[PASS] Line items correctly generated.`)
  }

  if (invoice.schedules.length !== 2) {
    console.error(`[FAIL] Expected 2 payment schedules (Deposit + Balance), got ${invoice.schedules.length}`)
  } else {
    const depositSchedule = invoice.schedules.find(s => s.description === 'Deposit')
    const balanceSchedule = invoice.schedules.find(s => s.description === 'Balance')
    
    if (depositSchedule?.status !== 'paid' || depositSchedule.amount !== 200) {
      console.error(`[FAIL] Deposit schedule incorrect. Expected paid 200, got ${depositSchedule?.status} ${depositSchedule?.amount}`)
    } else {
      console.log(`[PASS] Deposit schedule correctly marked as 'paid' for 200.`)
    }

    if (balanceSchedule?.status !== 'pending' || balanceSchedule.amount !== 1000) {
      console.error(`[FAIL] Balance schedule incorrect. Expected pending 1000, got ${balanceSchedule?.status} ${balanceSchedule?.amount}`)
    } else {
      console.log(`[PASS] Balance schedule correctly marked as 'pending' for 1000. Due: ${balanceSchedule?.due_date}`)
    }
  }

  if (invoice.payments.length !== 1) {
    console.error(`[FAIL] Expected 1 payment record, got ${invoice.payments.length}`)
  } else {
    const payment = invoice.payments[0]
    if (payment.stripe_payment_intent_id !== fakeStripeIntentId) {
      console.error(`[FAIL] Payment Stripe ID mismatch. Expected ${fakeStripeIntentId}, got ${payment.stripe_payment_intent_id}`)
    } else {
      console.log(`[PASS] Payment record correctly linked to Stripe Intent ${fakeStripeIntentId}`)
    }
  }

  console.log('--- Invoicing DB tests completed! ---\n')

  // ===== IDEMPOTENCY TESTS =====
  console.log('--- Idempotency Tests (Sequential + Concurrent) ---\n')

  // Test 1: Sequential idempotent retry
  console.log('[IDEMPOTENCY TEST 1] Sequential retry of markQuoteAccepted')
  const idempotencyQuoteId = crypto.randomUUID()
  await supabase.from('quotes').insert({
    id: idempotencyQuoteId,
    tenant_id: tenantId,
    lead_id: leadId,
    contact_id: contactId,
    status: 'sent',
    subtotal: 2000,
    surcharge_total: 300,
    total_price: 2300,
    deposit_amount: 500,
  })

  const fakeStripeId1 = 'pi_test_seq_' + crypto.randomUUID().slice(0, 8)

  // First call: should succeed
  const firstCall = await markQuoteAccepted(supabase, tenantId, idempotencyQuoteId, fakeStripeId1)
  if (!firstCall.success) {
    console.error(`[FAIL] First call should succeed, got error: ${firstCall.error}`)
  } else {
    console.log(`[PASS] First call succeeded, jobId: ${firstCall.jobId}`)
  }

  // Second call: should return alreadyAccepted flag, not fail
  const secondCall = await markQuoteAccepted(supabase, tenantId, idempotencyQuoteId, fakeStripeId1)
  if (secondCall.success) {
    console.error(`[FAIL] Second call should not succeed (quote already accepted)`)
  } else if ((secondCall as any).alreadyAccepted) {
    console.log(`[PASS] Second call correctly identified as idempotent retry (alreadyAccepted: true)`)
  } else {
    console.error(`[FAIL] Second call failed but not as idempotent retry: ${secondCall.error}`)
  }

  // Verify only one invoice exists for the job
  if (firstCall.success) {
    const invoices = await supabase
      .from('invoices')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('job_id', firstCall.jobId)

    if (invoices.data && invoices.data.length === 1) {
      console.log(`[PASS] Exactly one invoice exists for the job`)
    } else {
      console.error(`[FAIL] Expected 1 invoice, found ${invoices.data?.length || 0}`)
    }
  }

  // Test 2: Concurrent idempotent retries (Promise.all)
  console.log('\n[IDEMPOTENCY TEST 2] Concurrent retries via Promise.all')
  const concurrentQuoteId = crypto.randomUUID()
  await supabase.from('quotes').insert({
    id: concurrentQuoteId,
    tenant_id: tenantId,
    lead_id: leadId,
    contact_id: contactId,
    status: 'sent',
    subtotal: 3000,
    surcharge_total: 400,
    total_price: 3400,
    deposit_amount: 600,
  })

  const fakeStripeId2 = 'pi_test_conc_' + crypto.randomUUID().slice(0, 8)

  // Fire two calls concurrently
  const [concurrentFirst, concurrentSecond] = await Promise.allSettled([
    markQuoteAccepted(supabase, tenantId, concurrentQuoteId, fakeStripeId2),
    markQuoteAccepted(supabase, tenantId, concurrentQuoteId, fakeStripeId2),
  ]).then(results => [
    results[0].status === 'fulfilled' ? results[0].value : null,
    results[1].status === 'fulfilled' ? results[1].value : null,
  ])

  let concurrentSuccess = 0
  let concurrentIdempotent = 0

  if (concurrentFirst?.success) {
    concurrentSuccess++
  } else if ((concurrentFirst as any)?.alreadyAccepted) {
    concurrentIdempotent++
  }

  if (concurrentSecond?.success) {
    concurrentSuccess++
  } else if ((concurrentSecond as any)?.alreadyAccepted) {
    concurrentIdempotent++
  }

  if (concurrentSuccess === 1 && concurrentIdempotent === 1) {
    console.log(`[PASS] Concurrent calls: exactly one succeeded, one was idempotently rejected`)
  } else {
    console.error(
      `[FAIL] Concurrent calls: expected 1 success + 1 idempotent, got ${concurrentSuccess} success + ${concurrentIdempotent} idempotent`
    )
  }

  // Verify only one invoice exists for this concurrent job
  const jobIdConcurrent = concurrentFirst?.success ? concurrentFirst.jobId : concurrentSecond?.jobId
  if (jobIdConcurrent) {
    const invoicesConcurrent = await supabase
      .from('invoices')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('job_id', jobIdConcurrent)

    if (invoicesConcurrent.data && invoicesConcurrent.data.length === 1) {
      console.log(`[PASS] Concurrent: exactly one invoice exists for the job`)
    } else {
      console.error(`[FAIL] Concurrent: expected 1 invoice, found ${invoicesConcurrent.data?.length || 0}`)
    }
  }

  console.log('\n--- All tests (DB + Idempotency) completed! ---')
}

runTests().catch(e => {
  console.error(e)
  process.exit(1)
})
