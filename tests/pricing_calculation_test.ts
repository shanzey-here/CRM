/**
 * ============================================================================
 * PRICING CALCULATION TESTS
 * ============================================================================
 *
 * Tests for the configurable pricing engine:
 * - Known-input assertion (fixed volume/distance/rates → exact expected price)
 * - Cross-tenant comparison (two tenants, different rates, same inputs → different prices)
 * - Mutability guard (non-draft quote rejects recalculation)
 * - Override persistence (computed_price and final_price persist independently)
 * - Fixed-amount surcharge tests (single and multiple surcharges)
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Database = any

let testsPassed = 0
let testsFailed = 0

function pass(name: string) {
  console.log(`✓ ${name}`)
  testsPassed++
}

function fail(name: string, error: string) {
  console.error(`✗ ${name}`)
  console.error(`  ${error}`)
  testsFailed++
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  PRICING CALCULATION TEST SUITE')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const sr = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Create test tenants
  console.log('SETUP: Creating test tenants and data...\n')

  const { data: tenantA } = await sr
    .from('tenants')
    .insert({ name: 'Pricing Test A', slug: `pricing-a-${Date.now()}` })
    .select()
    .single()

  const { data: tenantB } = await sr
    .from('tenants')
    .insert({ name: 'Pricing Test B', slug: `pricing-b-${Date.now()}` })
    .select()
    .single()

  const tenantAId = tenantA!.id
  const tenantBId = tenantB!.id

  // Create contacts for quotes
  const { data: contactA } = await sr
    .from('contacts')
    .insert({
      tenant_id: tenantAId,
      first_name: 'Test',
      email: `test-a-${Date.now()}@test.com`,
      type: 'residential',
    })
    .select()
    .single()

  const { data: contactB } = await sr
    .from('contacts')
    .insert({
      tenant_id: tenantBId,
      first_name: 'Test',
      email: `test-b-${Date.now()}@test.com`,
      type: 'residential',
    })
    .select()
    .single()

  // Configure pricing_settings
  const { data: pricingA } = await sr
    .from('pricing_settings')
    .insert({
      tenant_id: tenantAId,
      per_cubic_foot_rate: 2.5,
      per_mile_rate: 1.2,
      labor_hourly_rate: 45.0,
      labour_hours_per_cubicft: 0.1,
      base_rate: 3500.0,
      surcharges: [
        { key: 'stairs', label: 'Stairs', amount: 150.0, type: 'fixed' },
        { key: 'long_carry', label: 'Long Carry', amount: 200.0, type: 'fixed' },
      ],
    })
    .select()
    .single()

  const { data: pricingB } = await sr
    .from('pricing_settings')
    .insert({
      tenant_id: tenantBId,
      per_cubic_foot_rate: 3.0,
      per_mile_rate: 1.5,
      labor_hourly_rate: 50.0,
      labour_hours_per_cubicft: 0.12,
      base_rate: 4000.0,
      surcharges: [
        { key: 'stairs', label: 'Stairs', amount: 200.0, type: 'fixed' },
      ],
    })
    .select()
    .single()

  // Create quotes
  const { data: quoteA } = await sr
    .from('quotes')
    .insert({
      tenant_id: tenantAId,
      contact_id: contactA!.id,
      status: 'draft',
      subtotal: 0,
      surcharge_total: 0,
      total_price: 0,
    })
    .select()
    .single()

  const { data: quoteB } = await sr
    .from('quotes')
    .insert({
      tenant_id: tenantBId,
      contact_id: contactB!.id,
      status: 'draft',
      subtotal: 0,
      surcharge_total: 0,
      total_price: 0,
    })
    .select()
    .single()

  const quoteAId = quoteA!.id
  const quoteBId = quoteB!.id

  console.log(`Created Tenant A: ${tenantAId.slice(0, 8)}...`)
  console.log(`Created Tenant B: ${tenantBId.slice(0, 8)}...`)
  console.log(`Created Quote A: ${quoteAId.slice(0, 8)}...`)
  console.log(`Created Quote B: ${quoteBId.slice(0, 8)}...\n`)

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 1: KNOWN-INPUT ASSERTION
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 1: KNOWN-INPUT CALCULATION')
  console.log('─────────────────────────────────────────────────────────────\n')

  // Input: 1500 cu-ft, 47,000 meters (29.2 miles)
  // Tenant A config:
  //   - per_cubic_foot_rate: 2.5
  //   - per_mile_rate: 1.2
  //   - labor_hourly_rate: 45.0
  //   - labour_hours_per_cubicft: 0.1
  //   - base_rate: 3500.0
  //   - surcharges: stairs (+150.0)
  //
  // Expected calculation:
  //   - volumeCost: 1500 * 2.5 = 3750.00
  //   - distanceCost: 29.23... * 1.2 = 35.08
  //   - labourHours: 1500 * 0.1 = 150
  //   - labourCost: 150 * 45 = 6750.00
  //   - surcharges: 150.00
  //   - subtotal: 3750 + 35.08 + 6750 + 150 = 10685.08
  //   - minimum: 3500 (doesn't apply)
  //   - total: 10685.08

  const { data: testResult1, error: testError1 } = await sr.rpc(
    'calculate_quote_price',
    {
      p_tenant_id: tenantAId,
      p_quote_id: quoteAId,
      p_total_volume: 1500,
      p_distance_meters: 47000,
      p_selected_surcharge_keys: ['stairs'],
    }
  )

  if (testError1) {
    fail(
      'Known-input calculation',
      `RPC error: ${testError1.message}`
    )
  } else if (!testResult1 || testResult1.length === 0) {
    fail('Known-input calculation', 'No result returned from RPC')
  } else {
    const result = testResult1[0]
    const computed = parseFloat(result.final_total)
    const expectedMin = 10680.0
    const expectedMax = 10690.0

    if (computed >= expectedMin && computed <= expectedMax) {
      pass('Known-input calculation')
      console.log(`  Computed price: $${computed.toFixed(2)}`)
      console.log(`  Breakdown:`)
      console.log(`    - Volume cost: $${parseFloat(result.volume_cost).toFixed(2)}`)
      console.log(`    - Distance cost: $${parseFloat(result.distance_cost).toFixed(2)}`)
      console.log(`    - Labour cost: $${parseFloat(result.labour_cost).toFixed(2)}`)
      console.log(`    - Surcharges: $${(parseFloat(result.volume_cost) + parseFloat(result.distance_cost) + parseFloat(result.labour_cost) - parseFloat(result.subtotal) + 150).toFixed(2)}`)
      console.log(`    - Subtotal: $${parseFloat(result.subtotal).toFixed(2)}`)
      console.log(`    - Min adjustment: $${parseFloat(result.minimum_adjustment).toFixed(2)}`)
    } else {
      fail(
        'Known-input calculation',
        `Expected ~$10685, got $${computed.toFixed(2)}`
      )
    }
  }

  console.log()

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 2: CROSS-TENANT COMPARISON
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 2: CROSS-TENANT COMPARISON')
  console.log('─────────────────────────────────────────────────────────────\n')

  const { data: testResult2A, error: testError2A } = await sr.rpc(
    'calculate_quote_price',
    {
      p_tenant_id: tenantAId,
      p_quote_id: quoteAId,
      p_total_volume: 1500,
      p_distance_meters: 47000,
      p_selected_surcharge_keys: [],
    }
  )

  const { data: testResult2B, error: testError2B } = await sr.rpc(
    'calculate_quote_price',
    {
      p_tenant_id: tenantBId,
      p_quote_id: quoteBId,
      p_total_volume: 1500,
      p_distance_meters: 47000,
      p_selected_surcharge_keys: [],
    }
  )

  if (testError2A || testError2B) {
    fail('Cross-tenant comparison', `RPC error`)
  } else if (!testResult2A || !testResult2B) {
    fail('Cross-tenant comparison', 'Missing result')
  } else {
    const priceA = parseFloat(testResult2A[0].final_total)
    const priceB = parseFloat(testResult2B[0].final_total)

    if (priceA !== priceB && Math.abs(priceA - priceB) > 100) {
      pass('Cross-tenant comparison')
      console.log(`  Tenant A (lower rates): $${priceA.toFixed(2)}`)
      console.log(`  Tenant B (higher rates): $${priceB.toFixed(2)}`)
      console.log(`  Difference: $${(priceB - priceA).toFixed(2)}`)
    } else {
      fail('Cross-tenant comparison', `Prices should differ; A=$${priceA.toFixed(2)}, B=$${priceB.toFixed(2)}`)
    }
  }

  console.log()

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 3: MUTABILITY GUARD (NON-DRAFT QUOTE)
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 3: MUTABILITY GUARD (NON-DRAFT QUOTE)')
  console.log('─────────────────────────────────────────────────────────────\n')

  // Update quote to 'sent' status
  await sr.from('quotes').update({ status: 'sent' }).eq('id', quoteAId)

  const { data: testResult3, error: testError3 } = await sr.rpc(
    'calculate_quote_price',
    {
      p_tenant_id: tenantAId,
      p_quote_id: quoteAId,
      p_total_volume: 1500,
      p_distance_meters: 47000,
      p_selected_surcharge_keys: [],
    }
  )

  if (testError3 && testError3.message.includes('non-draft')) {
    pass('Mutability guard (non-draft)')
    console.log(`  Error (expected): "${testError3.message}"`)
  } else {
    fail('Mutability guard (non-draft)', 'Should reject non-draft quote')
  }

  // Reset to draft for remaining tests
  await sr.from('quotes').update({ status: 'draft' }).eq('id', quoteAId)

  console.log()

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 4: OVERRIDE PERSISTENCE
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 4: OVERRIDE PERSISTENCE')
  console.log('─────────────────────────────────────────────────────────────\n')

  // Calculate price
  const { data: testResult4A } = await sr.rpc('calculate_quote_price', {
    p_tenant_id: tenantAId,
    p_quote_id: quoteAId,
    p_total_volume: 1500,
    p_distance_meters: 47000,
    p_selected_surcharge_keys: [],
  })

  const computed = parseFloat(testResult4A![0].final_total)

  // Save computed price
  await sr.from('quotes').update({ computed_price: computed }).eq('id', quoteAId)

  // Set override
  const overridePrice = 12000.0
  await sr
    .from('quotes')
    .update({ final_price: overridePrice })
    .eq('id', quoteAId)

  // Recalculate (should update computed, NOT final)
  const { data: testResult4B } = await sr.rpc('calculate_quote_price', {
    p_tenant_id: tenantAId,
    p_quote_id: quoteAId,
    p_total_volume: 1200, // Different volume
    p_distance_meters: 45000, // Different distance
    p_selected_surcharge_keys: [],
  })

  const newComputed = parseFloat(testResult4B![0].final_total)

  // Save new computed (this is what would happen in the app)
  await sr.from('quotes').update({ computed_price: newComputed }).eq('id', quoteAId)

  // Fetch and verify both values persisted
  const { data: quoteCheck } = await sr
    .from('quotes')
    .select('computed_price, final_price')
    .eq('id', quoteAId)
    .single()

  if (
    quoteCheck &&
    Math.abs(parseFloat(quoteCheck.computed_price!) - newComputed) < 0.01 &&
    Math.abs(parseFloat(quoteCheck.final_price!) - overridePrice) < 0.01
  ) {
    pass('Override persistence')
    console.log(`  Original computed: $${computed.toFixed(2)}`)
    console.log(`  Override set to: $${overridePrice.toFixed(2)}`)
    console.log(`  Recalculated: $${newComputed.toFixed(2)}`)
    console.log(`  After re-calculation:`)
    console.log(`    - computed_price: $${parseFloat(quoteCheck.computed_price!).toFixed(2)} ✓`)
    console.log(`    - final_price: $${parseFloat(quoteCheck.final_price!).toFixed(2)} ✓`)
  } else {
    fail('Override persistence', 'Override was overwritten or values mismatch')
  }

  console.log()

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 5: FIXED-AMOUNT SURCHARGES
  // ═════════════════════════════════════════════════════════════════════════
  console.log('TEST 5: FIXED-AMOUNT SURCHARGES')
  console.log('─────────────────────────────────────────────────────────────\n')

  // 5A: Single surcharge
  const { data: testResult5A } = await sr.rpc('calculate_quote_price', {
    p_tenant_id: tenantAId,
    p_quote_id: quoteAId,
    p_total_volume: 1000,
    p_distance_meters: 30000,
    p_selected_surcharge_keys: ['stairs'],
  })

  const price5A = parseFloat(testResult5A![0].final_total)
  const subtotal5A = parseFloat(testResult5A![0].subtotal)

  // Expected: 1000*2.5 + (30000/1609.34)*1.2 + 1000*0.1*45 + 150 = 2500 + 22.39 + 4500 + 150 = 7172.39
  if (price5A >= 7000 && price5A <= 7200) {
    pass('Single fixed surcharge')
    console.log(`  Subtotal (without surcharge): $${(subtotal5A - 150).toFixed(2)}`)
    console.log(`  Surcharge (stairs): $150.00`)
    console.log(`  Total: $${price5A.toFixed(2)}`)
  } else {
    fail('Single fixed surcharge', `Expected ~$7172, got $${price5A.toFixed(2)}`)
  }

  // 5B: Multiple surcharges
  const { data: testResult5B } = await sr.rpc('calculate_quote_price', {
    p_tenant_id: tenantAId,
    p_quote_id: quoteAId,
    p_total_volume: 1000,
    p_distance_meters: 30000,
    p_selected_surcharge_keys: ['stairs', 'long_carry'],
  })

  const price5B = parseFloat(testResult5B![0].final_total)

  // Expected: (same as 5A but +200 for long_carry) = 7372.39
  if (price5B >= 7350 && price5B <= 7400) {
    pass('Multiple fixed surcharges combined')
    console.log(`  Stairs: +$150.00`)
    console.log(`  Long Carry: +$200.00`)
    console.log(`  Total surcharges: +$350.00`)
    console.log(`  Final total: $${price5B.toFixed(2)}`)
  } else {
    fail('Multiple fixed surcharges combined', `Expected ~$7372, got $${price5B.toFixed(2)}`)
  }

  console.log()

  // ═════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═════════════════════════════════════════════════════════════════════════
  console.log('CLEANUP: Deleting test tenants...\n')
  await sr.from('tenants').delete().eq('id', tenantAId)
  await sr.from('tenants').delete().eq('id', tenantBId)

  // ═════════════════════════════════════════════════════════════════════════
  // RESULTS
  // ═════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (testsFailed === 0) {
    console.log('✓ All pricing tests passed!\n')
    process.exit(0)
  } else {
    console.log(`✗ ${testsFailed} test(s) failed\n`)
    process.exit(1)
  }
}

runTests().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
