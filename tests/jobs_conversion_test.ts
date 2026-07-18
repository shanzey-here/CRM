import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runTests() {
  console.log('--- Jobs Conversion Test ---')
  console.log('Using database:', supabaseUrl)

  // 1. Setup Data
  const { data: tenant, error: tErr } = await supabase.from('tenants').select('*').limit(1).single()
  if (tErr) throw new Error('No tenant found: ' + tErr.message)

  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .insert({ tenant_id: tenant.id, first_name: 'Job', last_name: 'Test', email: 'job@test.com' })
    .select()
    .single()
  if (cErr) throw new Error('Contact failed: ' + cErr.message)

  const { data: lead, error: lErr } = await supabase
    .from('leads')
    .insert({ tenant_id: tenant.id, contact_id: contact.id, stage: 'inquiry', preferred_move_date: '2027-01-01' })
    .select()
    .single()
  if (lErr) throw new Error('Lead failed: ' + lErr.message)

  const { data: quote, error: qErr } = await supabase
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
      public_token: `test_token_job_${Date.now()}`
    })
    .select()
    .single()

  if (qErr) throw new Error('Quote failed: ' + qErr.message)

  console.log('Setup complete. Executing quote acceptance logic...')

  const { markQuoteAccepted } = await import('../src/modules/quotes/server/repository')

  // Run the logic
  const acceptRes = await markQuoteAccepted(supabase, tenant.id, quote.id)
  console.log('Mark Accepted Result:', acceptRes.success ? 'Success' : acceptRes.error)

  if (!acceptRes.success) throw new Error('Failed to accept quote: ' + acceptRes.error)

  const jobId = (acceptRes as any).jobId

  // Validations
  console.log('\nValidating outcomes...')

  // 1. Quote Status
  const { data: updatedQuote } = await supabase.from('quotes').select('status, accepted_at').eq('id', quote.id).single()
  console.log(`Quote Status: ${updatedQuote?.status} (Expected: accepted)`)

  // 2. Lead Stage
  const { data: updatedLead } = await supabase.from('leads').select('stage').eq('id', lead.id).single()
  console.log(`Lead Stage: ${updatedLead?.stage} (Expected: confirmed_booking)`)

  // 3. Job Creation
  const { data: createdJob } = await supabase.from('jobs').select('*').eq('id', jobId).single()
  console.log(`Job Created: ${createdJob ? 'Yes' : 'No'}`)
  console.log(`Job Status: ${createdJob?.status} (Expected: scheduled)`)
  console.log(`Job Move Date: ${createdJob?.move_date} (Expected: 2027-01-01)`)

  // 4. Domain Event
  const { data: events } = await supabase.from('domain_events').select('*').eq('payload->>quote_id', quote.id)
  console.log(`Domain Events Emit Count: ${events?.length || 0} (Expected: 1)`)

  // Cleanup
  console.log('\nCleaning up...')
  await supabase.from('domain_events').delete().eq('payload->>quote_id', quote.id)
  if (jobId) await supabase.from('jobs').delete().eq('id', jobId)
  await supabase.from('quotes').delete().eq('id', quote.id)
  await supabase.from('leads').delete().eq('id', lead.id)
  await supabase.from('contacts').delete().eq('id', contact.id)

  console.log('Done.')
}

runTests().catch(console.error)
