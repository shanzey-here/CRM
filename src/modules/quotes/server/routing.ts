import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { fetchRouteDetails, geocodeAddress } from '@/lib/google-maps'

export type Address = Database['public']['Tables']['addresses']['Row']

export type RouteCalculationResult = {
  distanceMeters: number | null
  durationSeconds: number | null
  source: 'cache' | 'api' | 'error'
}

export type LegResult = {
  legName: string
  originString: string
  destinationString: string
  distanceMeters: number | null
  durationSeconds: number | null
  source: 'cache' | 'api' | 'error' | 'skipped'
}

export type FullCycleRouteResult = {
  totalDistanceMeters: number | null
  totalDurationSeconds: number | null
  legs: LegResult[]
  hasError: boolean
}

/**
 * Normalizes an address row into a string suitable for hashing or passing to Google Maps.
 */
function addressToString(addr: Partial<Address>): string {
  const parts = [addr.line_1, addr.line_2, addr.city, addr.county, addr.postcode, addr.country]
  return parts.filter((p) => p && typeof p === 'string' && p.trim() !== '').join(', ')
}

/**
 * Normalizes a string address into a lowercase, stripped hash key.
 */
function hashAddress(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Helper to construct the cache key. Prioritizes 4-decimal coordinates for ~11m precision,
 * falling back to the fragile string hash.
 */
function getCacheKey(addr: Partial<Address>): { key: string; isCoordinate: boolean; strValue: string } {
  const strValue = addressToString(addr)
  
  if (addr.lat !== null && addr.lat !== undefined && addr.lng !== null && addr.lng !== undefined) {
    // 4 decimal places gives approx 11 meters of precision
    const lat = Number(addr.lat).toFixed(4)
    const lng = Number(addr.lng).toFixed(4)
    return { key: `${lat},${lng}`, isCoordinate: true, strValue }
  }
  
  return { key: hashAddress(strValue), isCoordinate: false, strValue }
}

export async function getRouteDetails(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  origin: Partial<Address>,
  destination: Partial<Address>
): Promise<RouteCalculationResult> {
  try {
    let currentOrigin = { ...origin }
    let currentDestination = { ...destination }

    // 1. Lazy Geocoding (if missing lat/lng)
    let addressesUpdated = false
    
    if (currentOrigin.lat === null || currentOrigin.lat === undefined || currentOrigin.lng === null || currentOrigin.lng === undefined) {
      const geo = await geocodeAddress(addressToString(currentOrigin))
      if (geo) {
        currentOrigin = { ...currentOrigin, lat: geo.lat, lng: geo.lng }
        addressesUpdated = true
        // Fire & forget DB update only if it has a real UUID
        if (currentOrigin.id && currentOrigin.id.length > 20) {
          supabase.from('addresses').update({ lat: geo.lat, lng: geo.lng }).eq('id', currentOrigin.id).eq('tenant_id', tenantId).then()
        }
      }
    }

    if (currentDestination.lat === null || currentDestination.lat === undefined || currentDestination.lng === null || currentDestination.lng === undefined) {
      const geo = await geocodeAddress(addressToString(currentDestination))
      if (geo) {
        currentDestination = { ...currentDestination, lat: geo.lat, lng: geo.lng }
        addressesUpdated = true
        // Fire & forget DB update only if it has a real UUID
        if (currentDestination.id && currentDestination.id.length > 20) {
          supabase.from('addresses').update({ lat: geo.lat, lng: geo.lng }).eq('id', currentDestination.id).eq('tenant_id', tenantId).then()
        }
      }
    }

    // 2. Compute Cache Keys
    const oKeyData = getCacheKey(currentOrigin)
    const dKeyData = getCacheKey(currentDestination)

    // 3. Check Cache
    const { data: cachedRoute, error: cacheErr } = await supabase
      .from('route_cache')
      .select('*')
      .eq('origin_key', oKeyData.key)
      .eq('destination_key', dKeyData.key)
      .single()

    if (cachedRoute) {
      // Expiry Check: 90 days TTL
      const cacheDate = new Date(cachedRoute.created_at)
      const now = new Date()
      const daysOld = (now.getTime() - cacheDate.getTime()) / (1000 * 60 * 60 * 24)

      if (daysOld <= 90) {
        return {
          distanceMeters: cachedRoute.distance_meters,
          durationSeconds: cachedRoute.duration_seconds,
          source: 'cache'
        }
      }
      // If older than 90 days, we intentionally drop through to re-fetch
    }

    // 4. Cache Miss or Expired -> Call Google Distance Matrix
    // Pass precise coordinate strings if available, otherwise raw address strings
    const oApiQuery = oKeyData.isCoordinate ? `${currentOrigin.lat},${currentOrigin.lng}` : oKeyData.strValue
    const dApiQuery = dKeyData.isCoordinate ? `${currentDestination.lat},${currentDestination.lng}` : dKeyData.strValue

    const result = await fetchRouteDetails(oApiQuery, dApiQuery)

    // 5. Save to Cache
    if (cachedRoute) {
      // Update existing expired row
      await supabase.from('route_cache').update({
        distance_meters: result.distanceMeters,
        duration_seconds: result.durationSeconds,
        created_at: new Date().toISOString()
      }).eq('id', cachedRoute.id)
    } else {
      // Insert new row
      await supabase.from('route_cache').insert({
        origin_key: oKeyData.key,
        destination_key: dKeyData.key,
        distance_meters: result.distanceMeters,
        duration_seconds: result.durationSeconds,
      })
    }

    return {
      distanceMeters: result.distanceMeters,
      durationSeconds: result.durationSeconds,
      source: 'api'
    }

  } catch (err) {
    console.error('getRouteDetails Error:', err)
    // Return graceful fail-safe contract
    return {
      distanceMeters: null,
      durationSeconds: null,
      source: 'error'
    }
  }
}

/**
 * Calculates the full 3-leg cycle: Tenant Office -> Pickup -> Destination -> Tenant Office.
 * Uses the tenant's configured primary office as the default origin/dispatch point.
 */
export async function calculateFullCycleRoute(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  pickupAddress: Address,
  destinationAddress: Address
): Promise<FullCycleRouteResult> {
  // 1. Fetch Tenant Office Address
  const { data: tenantSettings } = await supabase
    .from('tenant_settings')
    .select('address_line_1, address_line_2, address_city, address_county, address_postcode, address_country')
    .eq('tenant_id', tenantId)
    .single()
    
  let officeAddress: Partial<Address> | null = null
  let officeString = ''
  
  if (tenantSettings && (tenantSettings.address_line_1 || tenantSettings.address_city || tenantSettings.address_postcode)) {
    officeAddress = {
      id: 'tenant-office', // pseudo-id to prevent DB save
      line_1: tenantSettings.address_line_1,
      line_2: tenantSettings.address_line_2,
      city: tenantSettings.address_city,
      county: tenantSettings.address_county,
      postcode: tenantSettings.address_postcode,
      country: tenantSettings.address_country,
      lat: null,
      lng: null
    }
    officeString = addressToString(officeAddress)
  }

  const pickupString = addressToString(pickupAddress)
  const destString = addressToString(destinationAddress)

  const emptyResult = (legName: string, oStr: string, dStr: string): LegResult => ({
    legName, originString: oStr, destinationString: dStr, distanceMeters: null, durationSeconds: null, source: 'skipped'
  })

  // We need to fetch 3 legs:
  // Leg 1: Office -> Pickup
  // Leg 2: Pickup -> Destination
  // Leg 3: Destination -> Office
  
  const legs: LegResult[] = []
  let totalDistance = 0
  let totalDuration = 0
  let hasError = false

  // Leg 1: Office -> Pickup
  if (officeAddress) {
    const leg1 = await getRouteDetails(supabase, tenantId, officeAddress, pickupAddress)
    legs.push({
      legName: 'Dispatch to Pickup',
      originString: officeString,
      destinationString: pickupString,
      distanceMeters: leg1.distanceMeters,
      durationSeconds: leg1.durationSeconds,
      source: leg1.source
    })
    if (leg1.source === 'error') hasError = true
    if (leg1.distanceMeters) totalDistance += leg1.distanceMeters
    if (leg1.durationSeconds) totalDuration += leg1.durationSeconds
  } else {
    legs.push(emptyResult('Dispatch to Pickup (No Office Set)', 'Unknown Office', pickupString))
  }

  // Leg 2: Pickup -> Destination
  const leg2 = await getRouteDetails(supabase, tenantId, pickupAddress, destinationAddress)
  legs.push({
    legName: 'Pickup to Delivery',
    originString: pickupString,
    destinationString: destString,
    distanceMeters: leg2.distanceMeters,
    durationSeconds: leg2.durationSeconds,
    source: leg2.source
  })
  if (leg2.source === 'error') hasError = true
  if (leg2.distanceMeters) totalDistance += leg2.distanceMeters
  if (leg2.durationSeconds) totalDuration += leg2.durationSeconds

  // Leg 3: Destination -> Office
  if (officeAddress) {
    const leg3 = await getRouteDetails(supabase, tenantId, destinationAddress, officeAddress)
    legs.push({
      legName: 'Delivery to Return',
      originString: destString,
      destinationString: officeString,
      distanceMeters: leg3.distanceMeters,
      durationSeconds: leg3.durationSeconds,
      source: leg3.source
    })
    if (leg3.source === 'error') hasError = true
    if (leg3.distanceMeters) totalDistance += leg3.distanceMeters
    if (leg3.durationSeconds) totalDuration += leg3.durationSeconds
  } else {
    legs.push(emptyResult('Delivery to Return (No Office Set)', destString, 'Unknown Office'))
  }

  return {
    totalDistanceMeters: hasError ? null : totalDistance,
    totalDurationSeconds: hasError ? null : totalDuration,
    legs,
    hasError
  }
}
