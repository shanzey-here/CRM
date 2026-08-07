import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function main() {
  const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data: userRow } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = userRow!.tenant_id
  const { data: contactRow } = await serviceClient.from('contacts').select('id').eq('tenant_id', tenantId).limit(1).single()

  // Seed a fresh, isolated draft invoice with a real pending payment_schedule and 0 payments,
  // dedicated to this concurrency test so it doesn't disturb other real data.
  const { data: invoice, error: invErr } = await serviceClient
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      contact_id: contactRow!.id,
      job_id: null,
      invoice_number: 'INV-RACE-TEST-' + Date.now(),
      status: 'draft',
      subtotal: 200,
      tax_amount: 0,
      total: 200,
      issued_at: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()
  if (invErr) { console.error('Invoice seed failed:', invErr.message); process.exit(1) }

  await serviceClient.from('invoice_line_items').insert({
    tenant_id: tenantId,
    invoice_id: invoice.id,
    description: 'Race test original item',
    quantity: 1,
    unit_price: 200,
    amount: 200,
    sort_order: 0,
  })

  const { data: schedule } = await serviceClient
    .from('payment_schedules')
    .insert({
      tenant_id: tenantId,
      invoice_id: invoice.id,
      description: 'Race test full payment',
      amount: 200,
      due_date: new Date().toISOString().slice(0, 10),
      status: 'pending',
    })
    .select()
    .single()

  console.log('Seeded race-test invoice:', invoice.id, '| schedule:', schedule!.id)

  const authedClient = createClient(SUPABASE_URL, ANON_KEY)
  await authedClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })

  // Fire the edit RPC and the real payment RPC CONCURRENTLY against the same invoice.
  const editPromise = (authedClient as any).rpc('update_draft_invoice', {
    p_tenant_id: tenantId,
    p_invoice_id: invoice.id,
    p_notes: 'Concurrent edit attempt',
    p_line_items: [{ description: 'RACE EDIT ITEM', quantity: 1, unit_price: 999, sort_order: 0 }],
  })
  const paymentPromise = serviceClient.rpc('record_invoice_payment', {
    p_tenant_id: tenantId,
    p_invoice_id: invoice.id,
    p_schedule_id: schedule!.id,
    p_stripe_intent_id: 'pi_test_race_condition',
    p_amount: 200,
  })

  const [editResult, paymentResult] = await Promise.all([editPromise, paymentPromise])

  console.log('\nEdit RPC result:', JSON.stringify({ data: editResult.data, error: editResult.error ? { message: editResult.error.message, code: editResult.error.code } : null }))
  console.log('Payment RPC result:', JSON.stringify({ data: paymentResult.data, error: paymentResult.error ? { message: paymentResult.error.message, code: paymentResult.error.code } : null }))

  const { data: finalInvoice } = await serviceClient.from('invoices').select('*').eq('id', invoice.id).single()
  const { data: finalItems } = await serviceClient.from('invoice_line_items').select('*').eq('invoice_id', invoice.id)
  const { data: finalPayments } = await serviceClient.from('payments').select('*').eq('invoice_id', invoice.id)

  console.log('\nFinal invoice state:', JSON.stringify(finalInvoice, null, 2))
  console.log('Final line items:', JSON.stringify(finalItems, null, 2))
  console.log('Final payments:', JSON.stringify(finalPayments, null, 2))

  // Consistency analysis
  const editSucceeded = !editResult.error
  const paymentSucceeded = !paymentResult.error
  console.log('\n=== Consistency check ===')
  console.log('Edit succeeded:', editSucceeded, '| Payment succeeded:', paymentSucceeded)
  if (editSucceeded && paymentSucceeded) {
    console.log('Both succeeded -> means edit committed BEFORE payment\'s status flip (valid: no payment existed yet when edit ran).')
    console.log('Final status should be paid/partially_paid, final line items should reflect the EDIT (proves edit was not silently lost or half-applied):', finalInvoice?.status, finalItems?.length === 1 && finalItems[0].description === 'RACE EDIT ITEM')
  } else if (!editSucceeded && paymentSucceeded) {
    console.log('Edit correctly REJECTED because payment won the race. Rejection code:', editResult.error.code, '(expected P0010, since record_invoice_payment flips status away from draft)')
    console.log('Final line items must be UNCHANGED (still original, not the attempted edit):', finalItems?.length === 1 && finalItems[0].description === 'Race test original item')
  } else {
    console.log('Unexpected outcome — investigate.')
  }

  // Cleanup this synthetic test fixture
  await serviceClient.from('payments').delete().eq('invoice_id', invoice.id)
  await serviceClient.from('payment_schedules').delete().eq('invoice_id', invoice.id)
  await serviceClient.from('invoice_line_items').delete().eq('invoice_id', invoice.id)
  await serviceClient.from('invoices').delete().eq('id', invoice.id)
  console.log('\nCleaned up synthetic race-test invoice.')
}
main()
