import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { fetchRouteDetails, geocodeAddress } from '@/lib/google-maps'

export type Address = Database['public']['Tables']['addresses']['Row']

export type RouteCalculationResult = {
  distanceMeters: number | null
  durationSeconds: number | null
  source: 'cache' | 'api' | 'error'
}

/**
 * Normalizes an address row into a string suitable for hashing or passing to Google Maps.
 */
function addressToString(addr: Address): string {
  const parts = [addr.line_1, addr.line_2, addr.city, addr.county, addr.postcode, addr.country]
  return parts.filter((p) => p && p.trim() !== '').join(', ')
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
function getCacheKey(addr: Address): { key: string; isCoordinate: boolean; strValue: string } {
  const strValue = addressToString(addr)
  
  if (addr.lat !== null && addr.lng !== null) {
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
  origin: Address,
  destination: Address
): Promise<RouteCalculationResult> {
  try {
    let currentOrigin = origin
    let currentDestination = destination

    // 1. Lazy Geocoding (if missing lat/lng)
    let addressesUpdated = false
    
    if (currentOrigin.lat === null || currentOrigin.lng === null) {
      const geo = await geocodeAddress(addressToString(currentOrigin))
      if (geo) {
        currentOrigin = { ...currentOrigin, lat: geo.lat, lng: geo.lng }
        addressesUpdated = true
        // Fire & forget DB update
        supabase.from('addresses').update({ lat: geo.lat, lng: geo.lng }).eq('id', currentOrigin.id).eq('tenant_id', tenantId).then()
      }
    }

    if (currentDestination.lat === null || currentDestination.lng === null) {
      const geo = await geocodeAddress(addressToString(currentDestination))
      if (geo) {
        currentDestination = { ...currentDestination, lat: geo.lat, lng: geo.lng }
        addressesUpdated = true
        // Fire & forget DB update
        supabase.from('addresses').update({ lat: geo.lat, lng: geo.lng }).eq('id', currentDestination.id).eq('tenant_id', tenantId).then()
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
