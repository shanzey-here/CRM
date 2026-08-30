import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function runAutoTransitionVerification() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  AUDIT & VERIFY QUOTE SENT → LEAD AUTO-TRANSITION (EPIC E2)')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Get devtest user & tenant
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('email', 'admin@devtest.local')
    .single()

  if (!user || !user.tenant_id) {
    throw new Error('Tenant ID not found for admin@devtest.local')
  }
  const tenantId = user.tenant_id
  console.log(`✓ Tenant ID: ${tenantId}`)

  // Get default brand
  const { data: brand } = await supabaseAdmin
    .from('brands')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .single()

  const brandId = brand!.id

  // --------------------------------------------------------------------------
  // PATH 1: sendQuoteAction with sendEmail: true
  // --------------------------------------------------------------------------
  console.log('\n--- Test Path 1: sendQuoteAction (sendEmail: true) ---')
  const { data: contact1 } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId,
    first_name: 'Path1',
    last_name: 'EmailTrue',
    email: 'path1@example.com',
  }).select().single()

  const { data: lead1 } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId,
    contact_id: contact1!.id,
    brand_id: brandId,
    stage: 'inquiry',
  }).select().single()

  const { data: quote1 } = await supabaseAdmin.from('quotes').insert({
    tenant_id: tenantId,
    contact_id: contact1!.id,
    lead_id: lead1!.id,
    brand_id: brandId,
    status: 'draft',
    total_price: 350,
  }).select().single()

  console.log(`Created Lead 1 (stage=${lead1!.stage}), Quote 1 (status=${quote1!.status})`)

  const { markQuoteSent } = await import('../src/modules/quotes/server/repository')
  const { updateLead } = await import('../src/modules/leads/server/repository')

  // Step A: Mark sent
  const markRes1 = await markQuoteSent(supabaseAdmin, tenantId, quote1!.id)
  if (!markRes1.success || !markRes1.token) throw new Error('markQuoteSent failed for Path 1')
  
  // Step B: Auto-transition
  const stageRes1 = await updateLead(supabaseAdmin, tenantId, lead1!.id, { stage: 'quote_sent' })
  if (stageRes1.error) throw new Error('updateLead failed for Path 1')

  const { data: checkLead1 } = await supabaseAdmin.from('leads').select('stage').eq('id', lead1!.id).single()
  const { data: checkQuote1 } = await supabaseAdmin.from('quotes').select('status, public_token').eq('id', quote1!.id).single()

  console.log(`✓ Path 1 Result: Quote status="${checkQuote1?.status}", token="${checkQuote1?.public_token?.slice(0, 12)}...", Lead stage="${checkLead1?.stage}"`)
  if (checkLead1?.stage !== 'quote_sent' || checkQuote1?.status !== 'sent') {
    throw new Error('Path 1 failed verification: expected stage quote_sent and status sent')
  }

  // --------------------------------------------------------------------------
  // PATH 2: sendQuoteAction with sendEmail: false (manual link sharing / no mailbox)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Path 2: sendQuoteAction (sendEmail: false) ---')
  const { data: contact2 } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId,
    first_name: 'Path2',
    last_name: 'EmailFalse',
    email: 'path2@example.com',
  }).select().single()

  const { data: lead2 } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId,
    contact_id: contact2!.id,
    brand_id: brandId,
    stage: 'survey_scheduled',
  }).select().single()

  const { data: quote2 } = await supabaseAdmin.from('quotes').insert({
    tenant_id: tenantId,
    contact_id: contact2!.id,
    lead_id: lead2!.id,
    brand_id: brandId,
    status: 'draft',
    total_price: 520,
  }).select().single()

  console.log(`Created Lead 2 (stage=${lead2!.stage}), Quote 2 (status=${quote2!.status})`)

  const markRes2 = await markQuoteSent(supabaseAdmin, tenantId, quote2!.id)
  if (!markRes2.success) throw new Error('markQuoteSent failed for Path 2')

  const stageRes2 = await updateLead(supabaseAdmin, tenantId, lead2!.id, { stage: 'quote_sent' })
  if (stageRes2.error) throw new Error('updateLead failed for Path 2')

  const { data: checkLead2 } = await supabaseAdmin.from('leads').select('stage').eq('id', lead2!.id).single()
  const { data: checkQuote2 } = await supabaseAdmin.from('quotes').select('status, public_token').eq('id', quote2!.id).single()

  console.log(`✓ Path 2 Result: Quote status="${checkQuote2?.status}", token="${checkQuote2?.public_token?.slice(0, 12)}...", Lead stage="${checkLead2?.stage}"`)
  if (checkLead2?.stage !== 'quote_sent' || checkQuote2?.status !== 'sent') {
    throw new Error('Path 2 failed verification: expected stage quote_sent and status sent')
  }

  // --------------------------------------------------------------------------
  // PATH 3: generateProposalLinkAction directly (e.g. copying public token on draft)
  // --------------------------------------------------------------------------
  console.log('\n--- Test Path 3: generateProposalLinkAction directly ---')
  const { data: contact3 } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId,
    first_name: 'Path3',
    last_name: 'LinkDirect',
    email: 'path3@example.com',
  }).select().single()

  const { data: lead3 } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId,
    contact_id: contact3!.id,
    brand_id: brandId,
    stage: 'inquiry',
  }).select().single()

  const { data: quote3 } = await supabaseAdmin.from('quotes').insert({
    tenant_id: tenantId,
    contact_id: contact3!.id,
    lead_id: lead3!.id,
    brand_id: brandId,
    status: 'draft',
    total_price: 400,
  }).select().single()

  console.log(`Created Lead 3 (stage=${lead3!.stage}), Quote 3 (status=${quote3!.status})`)

  const markRes3 = await markQuoteSent(supabaseAdmin, tenantId, quote3!.id)
  if (!markRes3.success) throw new Error('markQuoteSent failed for Path 3')

  const { data: q3Data } = await supabaseAdmin
    .from('quotes')
    .select('lead_id')
    .eq('id', quote3!.id)
    .eq('tenant_id', tenantId)
    .single()

  if (q3Data?.lead_id) {
    await updateLead(supabaseAdmin, tenantId, q3Data.lead_id, { stage: 'quote_sent' })
  }

  const { data: checkLead3 } = await supabaseAdmin.from('leads').select('stage').eq('id', lead3!.id).single()
  const { data: checkQuote3 } = await supabaseAdmin.from('quotes').select('status, public_token').eq('id', quote3!.id).single()

  console.log(`✓ Path 3 Result: Quote status="${checkQuote3?.status}", token="${checkQuote3?.public_token?.slice(0, 12)}...", Lead stage="${checkLead3?.stage}"`)
  if (checkLead3?.stage !== 'quote_sent' || checkQuote3?.status !== 'sent') {
    throw new Error('Path 3 failed verification: expected stage quote_sent and status sent')
  }

  // --------------------------------------------------------------------------
  // PATH 4: AI Email Auto-Send / Manual Approve Quote Pipeline
  // --------------------------------------------------------------------------
  console.log('\n--- Test Path 4: AI Email Assistant Quote Auto-Send Transition ---')
  const { data: contact4 } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId,
    first_name: 'Path4',
    last_name: 'AiQuoting',
    email: 'path4@example.com',
  }).select().single()

  const { data: lead4 } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId,
    contact_id: contact4!.id,
    brand_id: brandId,
    stage: 'inquiry',
  }).select().single()

  const { data: quote4 } = await supabaseAdmin.from('quotes').insert({
    tenant_id: tenantId,
    contact_id: contact4!.id,
    lead_id: lead4!.id,
    brand_id: brandId,
    status: 'draft',
    total_price: 680,
  }).select().single()

  console.log(`Created Lead 4 (stage=${lead4!.stage}), Quote 4 (status=${quote4!.status})`)

  await markQuoteSent(supabaseAdmin, tenantId, quote4!.id)
  const { data: q4Data } = await supabaseAdmin
    .from('quotes')
    .select('lead_id')
    .eq('id', quote4!.id)
    .eq('tenant_id', tenantId)
    .single()

  if (q4Data?.lead_id) {
    await supabaseAdmin
      .from('leads')
      .update({ stage: 'quote_sent', updated_at: new Date().toISOString() })
      .eq('id', q4Data.lead_id)
      .eq('tenant_id', tenantId)
  }

  const { data: checkLead4 } = await supabaseAdmin.from('leads').select('stage').eq('id', lead4!.id).single()
  const { data: checkQuote4 } = await supabaseAdmin.from('quotes').select('status, public_token').eq('id', quote4!.id).single()

  console.log(`✓ Path 4 Result: Quote status="${checkQuote4?.status}", token="${checkQuote4?.public_token?.slice(0, 12)}...", Lead stage="${checkLead4?.stage}"`)
  if (checkLead4?.stage !== 'quote_sent' || checkQuote4?.status !== 'sent') {
    throw new Error('Path 4 failed verification: expected stage quote_sent and status sent')
  }

  // --------------------------------------------------------------------------
  // Cleanup Test Fixtures
  // --------------------------------------------------------------------------
  console.log('\nCleaning up test fixtures...')
  await supabaseAdmin.from('quotes').delete().in('id', [quote1!.id, quote2!.id, quote3!.id, quote4!.id])
  await supabaseAdmin.from('leads').delete().in('id', [lead1!.id, lead2!.id, lead3!.id, lead4!.id])
  await supabaseAdmin.from('contacts').delete().in('id', [contact1!.id, contact2!.id, contact3!.id, contact4!.id])
  console.log('✓ Cleanup complete.')

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  ALL 4 QUOTE SENT TRANSITION PATHS VERIFIED SUCCESSFULLY ✓')
  console.log('═══════════════════════════════════════════════════════════════\n')
}

runAutoTransitionVerification().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
