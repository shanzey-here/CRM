import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const NEGOTIATED_CONTACT_ID = process.argv[2]
const NEGOTIATED_QUOTE_ID = process.argv[3]
const STANDARD_CONTACT_ID = process.argv[4]
const STANDARD_QUOTE_ID = process.argv[5]

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function signInAs(email: string, password: string) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

async function main() {
  const { calculateQuotePrice, savePricingCalculation } = await import('../../src/modules/quotes/server/pricing')
  const { upsertContactPricingOverride, setContactPricingOverrideActive, getContactPricingOverride } = await import(
    '../../src/modules/clients/server/pricing-overrides'
  )

  const { data: admin } = await serviceClient.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const adminClient = await signInAs('admin@devtest.local', 'DevTest123!')
  const dispatcherClient = await signInAs('dispatcher@devtest.local', 'DevTest123!')

  console.log('========== 1. Set a real 15% negotiated rate as tenant_admin (real RLS session) ==========')
  const { data: overrideRow, error: overrideErr } = await upsertContactPricingOverride(
    adminClient as any,
    tenantId,
    NEGOTIATED_CONTACT_ID,
    { discount_percent: 15, notes: 'Corporate negotiated rate — integration test' },
    admin!.id
  )
  console.log('Override row:', JSON.stringify(overrideRow, null, 2), 'error:', overrideErr?.message)
  if (overrideErr || !overrideRow) throw new Error('Failed to set override')

  console.log('\n========== 2. Real pricing calculation for the NEGOTIATED contact ==========')
  const negotiatedResult = await calculateQuotePrice(serviceClient, {
    tenantId,
    quoteId: NEGOTIATED_QUOTE_ID,
    contactId: NEGOTIATED_CONTACT_ID,
    totalVolume: 500,
    distanceMeters: 16093, // ~10 miles
    selectedSurcharges: [],
  })
  console.log(JSON.stringify(negotiatedResult, null, 2))
  if (!negotiatedResult.success || !negotiatedResult.result) throw new Error('Negotiated pricing calc failed')
  const nb = negotiatedResult.result.breakdown
  const expectedStandard = 500 * 0.5 + 10 * 1 + 500 * 0.1 * 100 // volume + distance + labour = 250+10+5000 = 5260
  console.log(`Hand-computed standard total: ${expectedStandard} (expect subtotal > base_rate=100, so final_total = subtotal = ${expectedStandard})`)
  console.log(`Expected negotiated total (15% off): ${Math.round(expectedStandard * 0.85 * 100) / 100}`)
  console.log('Math check — standardTotal matches hand-computed:', nb.standardTotal === expectedStandard)
  console.log('Math check — negotiatedDiscountPercent === 15:', nb.negotiatedDiscountPercent === 15)
  console.log('Math check — total === standardTotal * 0.85:', nb.total === Math.round(expectedStandard * 0.85 * 100) / 100)
  console.log('Math check — computedPrice === total:', negotiatedResult.result.computedPrice === nb.total)

  const saveNegotiated = await savePricingCalculation(serviceClient, tenantId, NEGOTIATED_QUOTE_ID, negotiatedResult.result.computedPrice, [], nb)
  console.log('Save result:', saveNegotiated)
  const { data: savedNegotiatedQuote } = await serviceClient
    .from('quotes')
    .select('computed_price, standard_price, negotiated_discount_percent')
    .eq('id', NEGOTIATED_QUOTE_ID)
    .single()
  console.log('Persisted quote snapshot (must show BOTH figures, never just the smaller number):', JSON.stringify(savedNegotiatedQuote, null, 2))

  console.log('\n========== 3. REGRESSION: standard contact with no override ==========')
  const standardResult = await calculateQuotePrice(serviceClient, {
    tenantId,
    quoteId: STANDARD_QUOTE_ID,
    contactId: STANDARD_CONTACT_ID,
    totalVolume: 500,
    distanceMeters: 16093,
    selectedSurcharges: [],
  })
  console.log(JSON.stringify(standardResult, null, 2))
  if (!standardResult.success || !standardResult.result) throw new Error('Standard pricing calc failed')
  const sb = standardResult.result.breakdown
  console.log('Regression check — standardTotal === total (no discount applied):', sb.standardTotal === sb.total)
  console.log('Regression check — negotiatedDiscountPercent === null:', sb.negotiatedDiscountPercent === null)
  console.log('Regression check — total === same hand-computed standard figure as negotiated contact got:', sb.total === expectedStandard)

  const saveStandard = await savePricingCalculation(serviceClient, tenantId, STANDARD_QUOTE_ID, standardResult.result.computedPrice, [], sb)
  console.log('Save result:', saveStandard)
  const { data: savedStandardQuote } = await serviceClient
    .from('quotes')
    .select('computed_price, standard_price, negotiated_discount_percent')
    .eq('id', STANDARD_QUOTE_ID)
    .single()
  console.log('Persisted quote snapshot (standard_price/negotiated_discount_percent must both be null):', JSON.stringify(savedStandardQuote, null, 2))

  console.log('\n========== 4. Deactivate the override, confirm reversion to standard pricing ==========')
  const { data: deactivated, error: deactivateErr } = await setContactPricingOverrideActive(adminClient as any, tenantId, NEGOTIATED_CONTACT_ID, false)
  console.log('Deactivated row:', JSON.stringify(deactivated, null, 2), 'error:', deactivateErr?.message)

  const { data: newQuote } = await serviceClient
    .from('quotes')
    .insert({ tenant_id: tenantId, contact_id: NEGOTIATED_CONTACT_ID, status: 'draft' })
    .select()
    .single()
  console.log('Fresh draft quote for post-deactivation test:', newQuote!.id)

  const postDeactivationResult = await calculateQuotePrice(serviceClient, {
    tenantId,
    quoteId: newQuote!.id,
    contactId: NEGOTIATED_CONTACT_ID,
    totalVolume: 500,
    distanceMeters: 16093,
    selectedSurcharges: [],
  })
  console.log(JSON.stringify(postDeactivationResult, null, 2))
  console.log(
    'Reverted to standard pricing after deactivation:',
    postDeactivationResult.result?.breakdown.negotiatedDiscountPercent === null && postDeactivationResult.result?.computedPrice === expectedStandard
  )

  console.log('\n========== 5. Dispatcher can READ the (now inactive) override, but CANNOT write ==========')
  const { data: dispatcherRead, error: dispatcherReadErr } = await getContactPricingOverride(dispatcherClient as any, tenantId, NEGOTIATED_CONTACT_ID)
  console.log('Dispatcher read of override:', JSON.stringify(dispatcherRead, null, 2), 'error:', dispatcherReadErr?.message)

  const { data: dispatcherWrite, error: dispatcherWriteErr } = await upsertContactPricingOverride(
    dispatcherClient as any,
    tenantId,
    NEGOTIATED_CONTACT_ID,
    { discount_percent: 99, notes: 'dispatcher attempting to self-grant a rate' },
    admin!.id
  )
  console.log('Dispatcher write attempt (must fail):', JSON.stringify(dispatcherWrite, null, 2), 'error:', dispatcherWriteErr?.message)

  console.log('\n========== 6. Cross-tenant isolation ==========')
  const { data: tenantB } = await serviceClient
    .from('tenants')
    .insert([{ name: 'Tenant B Corporate Pricing Test', slug: `tenant-b-corp-pricing-${Date.now()}` }])
    .select()
    .single()
  const { data: contactB } = await serviceClient.from('contacts').insert({ tenant_id: tenantB!.id, first_name: 'TenantB', last_name: 'Contact' }).select().single()
  const { data: overrideB } = await serviceClient
    .from('contact_pricing_overrides')
    .insert({ tenant_id: tenantB!.id, contact_id: contactB!.id, discount_percent: 50, created_by: admin!.id })
    .select()
    .single()
  console.log('Tenant B override (real row, created via service role):', overrideB!.id)

  const { data: crossRead, error: crossReadErr } = await getContactPricingOverride(adminClient as any, tenantId, contactB!.id)
  console.log('Tenant A session reading Tenant B contact_id directly (must be null):', JSON.stringify(crossRead), 'error:', crossReadErr?.message)

  const { data: crossList } = await adminClient.from('contact_pricing_overrides').select('id, tenant_id')
  console.log(
    "Tenant A's full visible override list contains Tenant B's row (must be false):",
    (crossList ?? []).some((r: any) => r.id === overrideB!.id)
  )

  // Cleanup tenant B fixture only (tenant A fixtures kept for UI inspection)
  await serviceClient.from('contact_pricing_overrides').delete().eq('id', overrideB!.id)
  await serviceClient.from('contacts').delete().eq('id', contactB!.id)
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nTenant B cleanup complete.')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
