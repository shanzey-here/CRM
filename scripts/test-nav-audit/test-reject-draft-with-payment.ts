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

  const INVOICE_ID = 'f44c83f8-93b1-456a-b65b-10d4b71b90de'

  // Confirm it's still a genuine draft with zero payments before seeding
  const { data: beforeSeed } = await serviceClient.from('invoices').select('id, status').eq('id', INVOICE_ID).single()
  const { data: existingPayments } = await serviceClient.from('payments').select('id').eq('invoice_id', INVOICE_ID)
  console.log('Invoice status before seeding:', beforeSeed?.status, '| existing payments:', existingPayments?.length)

  // Seed a real payment_schedule + real payments row against this still-draft invoice —
  // simulating the real scenario the added guard protects against: a customer has already
  // paid a deposit while the invoice is technically still in draft status.
  const { data: schedule, error: scheduleErr } = await serviceClient
    .from('payment_schedules')
    .insert({
      tenant_id: tenantId,
      invoice_id: INVOICE_ID,
      description: 'Test seeded deposit schedule',
      amount: 100,
      due_date: new Date().toISOString().slice(0, 10),
      status: 'paid',
    })
    .select()
    .single()
  if (scheduleErr) { console.error('Schedule insert failed:', scheduleErr.message); process.exit(1) }

  const { data: payment, error: paymentErr } = await serviceClient
    .from('payments')
    .insert({
      tenant_id: tenantId,
      invoice_id: INVOICE_ID,
      payment_schedule_id: schedule.id,
      amount: 100,
      method: 'card',
      stripe_payment_intent_id: 'pi_test_seeded_guard_check',
      status: 'succeeded',
      paid_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (paymentErr) { console.error('Payment insert failed:', paymentErr.message); process.exit(1) }
  console.log('Seeded real payment:', JSON.stringify(payment))

  const { data: statusAfterSeed } = await serviceClient.from('invoices').select('status').eq('id', INVOICE_ID).single()
  console.log('Invoice status AFTER seeding payment (must still be draft):', statusAfterSeed?.status)

  // Now attempt the real edit as a real authenticated tenant_admin, bypassing the UI
  const authedClient = createClient(SUPABASE_URL, ANON_KEY)
  await authedClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })

  const { data: before } = await serviceClient.from('invoices').select('id, status, subtotal, total, notes').eq('id', INVOICE_ID).single()
  console.log('\nTarget invoice BEFORE attack attempt:', JSON.stringify(before))

  const { data, error } = await (authedClient as any).rpc('update_draft_invoice', {
    p_tenant_id: tenantId,
    p_invoice_id: INVOICE_ID,
    p_notes: 'ATTACK: should never persist despite draft status',
    p_line_items: [{ description: 'ATTACK ITEM', quantity: 1, unit_price: 999999, sort_order: 0 }],
  })

  console.log('\nRPC call result data:', JSON.stringify(data))
  console.log('RPC call error:', error ? JSON.stringify({ message: error.message, code: error.code }) : null)

  const { data: after } = await serviceClient.from('invoices').select('id, status, subtotal, total, notes').eq('id', INVOICE_ID).single()
  console.log('\nTarget invoice AFTER attack attempt:', JSON.stringify(after))
  console.log('Unchanged (attack correctly rejected despite status=draft):', JSON.stringify(before) === JSON.stringify(after))
}
main()
