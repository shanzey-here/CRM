import { createClient } from '@supabase/supabase-js'
import { Database } from '../src/types/database.types'
import { getRouteDetails, Address } from '../src/modules/quotes/server/routing'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// Note: To test actual hit/miss logic without calling Google Maps, 
// we rely on the DB records explicitly and use a dummy key format that triggers a mock or a raw failure gracefully.
// Since we have implemented the 'error' source fallback, we can simulate API errors easily by not passing a valid key.

async function runRoutingTests() {
  console.log('--- Starting Routing Cache Tests ---')
  let testTenantId = ''
  
  // We'll create two dummy addresses
  const dummyOrigin: Address = {
    id: '00000000-0000-0000-0000-000000000001',
    tenant_id: '00000000-0000-0000-0000-000000000000',
    line_1: '123 Fake St',
    line_2: null,
    city: 'Mocktown',
    county: null,
    postcode: 'MK1 1AA',
    country: 'GB',
    lat: 51.0001,
    lng: -0.5002,
    access_notes: null,
    floor_level: null,
    has_lift: null,
    parking_notes: null,
    created_at: new Date().toISOString(),
    updated_at: null
  }

  const dummyDestination: Address = {
    id: '00000000-0000-0000-0000-000000000002',
    tenant_id: '00000000-0000-0000-0000-000000000000',
    line_1: '456 Real Rd',
    line_2: null,
    city: 'Testville',
    county: null,
    postcode: 'TS2 2BB',
    country: 'GB',
    lat: 52.0003,
    lng: -1.5004,
    access_notes: null,
    floor_level: null,
    has_lift: null,
    parking_notes: null,
    created_at: new Date().toISOString(),
    updated_at: null
  }

  try {
    const { data: t1 } = await supabase.from('tenants').insert({ name: 'Route Tenant', slug: 'route-' + Date.now() }).select().single()
    testTenantId = t1!.id
    dummyOrigin.tenant_id = testTenantId
    dummyDestination.tenant_id = testTenantId

    // 1. Force a Cache Miss -> API Error (no key) -> Check Fallback
    console.log('Testing fallback on API error...')
    const errorResult = await getRouteDetails(supabase, testTenantId, dummyOrigin, dummyDestination)
    if (errorResult.source !== 'error') {
      throw new Error(`Expected error source, got ${errorResult.source}`)
    }
    console.log('✅ Fallback correctly engaged on API miss/error')

    // 2. Pre-seed the cache to force a Hit
    console.log('Testing cache hit...')
    const oKey = '51.0001,-0.5002'
    const dKey = '52.0003,-1.5004'
    await supabase.from('route_cache').insert({
      origin_key: oKey,
      destination_key: dKey,
      distance_meters: 15000,
      duration_seconds: 1200
    })

    const hitResult = await getRouteDetails(supabase, testTenantId, dummyOrigin, dummyDestination)
    if (hitResult.source !== 'cache') {
      throw new Error(`Expected cache hit, got ${hitResult.source}`)
    }
    if (hitResult.distanceMeters !== 15000) {
      throw new Error(`Expected distance 15000, got ${hitResult.distanceMeters}`)
    }
    console.log('✅ Route cleanly fetched from DB cache')

    // 3. Force Cache Expiry (TTL 90 days)
    console.log('Testing 90-day expiry...')
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 95)
    await supabase.from('route_cache').update({ created_at: oldDate.toISOString() }).eq('origin_key', oKey)

    const expiryResult = await getRouteDetails(supabase, testTenantId, dummyOrigin, dummyDestination)
    // Since API will fail (no key), we should get 'error' rather than 'cache'
    if (expiryResult.source === 'cache') {
      throw new Error('Cache TTL failed. Expired row was treated as a hit.')
    }
    console.log('✅ TTL successfully rejected old cache row')

  } catch (err: any) {
    console.error('❌ Test failed:', err.message)
    process.exit(1)
  } finally {
    if (testTenantId) await supabase.from('tenants').delete().eq('id', testTenantId)
    await supabase.from('route_cache').delete().eq('origin_key', '51.0001,-0.5002')
    console.log('--- Cleanup Complete ---')
  }
}

runRoutingTests()
