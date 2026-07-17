import { Client, GeocodeResult, DistanceMatrixResponseData, TravelMode } from '@googlemaps/google-maps-services-js'

// We create a singleton client instance
const client = new Client({})

export type RouteDetails = {
  distanceMeters: number
  durationSeconds: number
}

function getApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    throw new Error('GOOGLE_MAPS_API_KEY is missing from environment variables')
  }
  return key
}

/**
 * Geocodes a string address to a latitude/longitude pair.
 */
export async function geocodeAddress(addressStr: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await client.geocode({
      params: {
        address: addressStr,
        key: getApiKey(),
      },
    })

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location
      return { lat: location.lat, lng: location.lng }
    }
    return null
  } catch (err: any) {
    console.error('[GoogleMaps API Error] geocodeAddress:', err.response?.data?.error_message || err.message)
    throw new Error('Geocoding failed')
  }
}

/**
 * Fetches distance and time between two points.
 * Points can be string addresses or "lat,lng" coordinates.
 */
export async function fetchRouteDetails(origin: string, destination: string): Promise<RouteDetails> {
  try {
    const response = await client.distancematrix({
      params: {
        origins: [origin],
        destinations: [destination],
        mode: TravelMode.driving,
        key: getApiKey(),
      },
    })

    const data: DistanceMatrixResponseData = response.data

    if (data.status !== 'OK') {
      throw new Error(`Distance Matrix API returned status: ${data.status} - ${data.error_message}`)
    }

    const element = data.rows[0]?.elements[0]

    if (!element || element.status !== 'OK') {
      throw new Error(`Route not found (Status: ${element?.status})`)
    }

    return {
      distanceMeters: element.distance.value,
      durationSeconds: element.duration.value,
    }
  } catch (err: any) {
    console.error('[GoogleMaps API Error] fetchRouteDetails:', err.response?.data?.error_message || err.message)
    throw new Error('Routing failed')
  }
}
