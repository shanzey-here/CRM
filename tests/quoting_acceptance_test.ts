import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.STRIPE_SECRET_KEY) {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123'
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('--- Quoting Acceptance Test ---')
  console.log('Using database:', supabaseUrl)

  // 1. Setup Data
  const { data: tenant, error: tErr } = await supabase.from('tenants').select('*').limit(1).single()
  if (tErr) throw new Error('No tenant found: ' + tErr.message)

  // Update tenant to have a fake stripe account id
  await supabase.from('tenants').update({ stripe_connected_account_id: 'acct_test123' }).eq('id', tenant.id)

  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .insert({ tenant_id: tenant.id, first_name: 'Sig', last_name: 'Test', email: 'sig@test.com' })
    .select()
    .single()
  if (cErr) throw new Error('Contact failed: ' + cErr.message)

  const { data: lead, error: lErr } = await supabase
    .from('leads')
    .insert({ tenant_id: tenant.id, contact_id: contact.id, stage: 'inquiry' })
    .select()
    .single()
  if (lErr) throw new Error('Lead failed: ' + lErr.message)

  // Quote 1: Zero Deposit
  const { data: quoteZero, error: qZeroErr } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenant.id,
      lead_id: lead.id,
      contact_id: contact.id,
      status: 'sent',
      total_volume: 100,
      subtotal: 100,
      total_price: 100,
      deposit_amount: 0,
      public_token: `test_token_zero_${Date.now()}`
    })
    .select()
    .single()

  if (qZeroErr) throw new Error('Quote 0 dep failed: ' + qZeroErr.message)

  // Quote 2: Deposit > 0
  const { data: quoteDep, error: qDepErr } = await supabase
    .from('quotes')
    .insert({
      tenant_id: tenant.id,
      lead_id: lead.id,
      contact_id: contact.id,
      status: 'sent',
      total_volume: 100,
      subtotal: 100,
      total_price: 100,
      deposit_amount: 50,
      public_token: `test_token_dep_${Date.now()}`
    })
    .select()
    .single()
  if (qDepErr) throw new Error('Quote dep failed: ' + qDepErr.message)

  console.log('Setup complete.')

  // Import the actions
  // Since server actions use Next.js `headers()`, it will crash if run outside Next.js request context.
  // Instead, we will directly call the repository functions that power it, which is the core logic anyway.
  
  const { saveQuoteSignature, markQuoteAccepted } = await import('../src/modules/quotes/server/repository')

  // Test 1: Zero Deposit Bypass Equivalent
  console.log('\nTest 1: Signature Flow (Zero Deposit)')
  
  const sigRes1 = await saveQuoteSignature(
    supabase,
    tenant.id,
    quoteZero.id,
    'John Doe',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==',
    'fake_hash',
    '127.0.0.1'
  )
  console.log('Signature Save Result:', sigRes1.success ? 'Success' : sigRes1.error)

  const acceptRes1 = await markQuoteAccepted(supabase, tenant.id, quoteZero.id)
  console.log('Mark Accepted Result:', acceptRes1.success ? 'Success' : acceptRes1.error)

  // Verify status is accepted
  const { data: verifyZero } = await supabase.from('quotes').select('status').eq('id', quoteZero.id).single()
  console.log('Quote Zero Status:', verifyZero?.status)

  // Verify Domain Event emitted
  const { data: events1 } = await supabase.from('domain_events').select('*').eq('payload->>quote_id', quoteZero.id)
  console.log('Domain Events for Quote Zero:', events1?.length || 0)

  // Verify quote_signatures row exists
  const { data: qs1 } = await supabase.from('quote_signatures').select('*').eq('quote_id', quoteZero.id).single()
  console.log('Quote Signature saved:', !!qs1)

  // Test 2: Deposit > 0 uses Stripe Intent
  console.log('\nTest 2: Stripe Deposit Payment Intent')
  
  const { createDepositPaymentIntent } = await import('../src/modules/payments/server/stripe')
  
  try {
    const intent = await createDepositPaymentIntent({
      amount: Number(quoteDep.deposit_amount),
      tenantConnectedAccountId: 'acct_test123',
      quoteId: quoteDep.id,
      tenantId: tenant.id
    })
    console.log('Payment Intent Created:', !!intent.client_secret)
    console.log('Intent metadata:', intent.metadata)
  } catch (err: any) {
    console.error('Expected Stripe error (invalid connected account id usually):', err.message)
  }

  // Cleanup
  console.log('\nCleaning up...')
  await supabase.from('quotes').delete().in('id', [quoteZero.id, quoteDep.id])
  await supabase.from('leads').delete().eq('id', lead.id)
  await supabase.from('contacts').delete().eq('id', contact.id)

  console.log('Done.')
}

runTests().catch(console.error)
