import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const PROFILE_ID = '6a674be29864163b359b763c'

async function attempt(label: string, url: string) {
  console.log(`\n=== ${label} ===`)
  console.log('URL:', url)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
  const text = await res.text()
  console.log('status:', res.status)
  try {
    const data = JSON.parse(text)
    console.log('authUrl:', data.authUrl)
    // Decode the state param to see the embedded redirect target.
    const stateMatch = data.authUrl?.match(/state=([^&]+)/)
    if (stateMatch) console.log('decoded state:', decodeURIComponent(stateMatch[1]))
  } catch {
    console.log('(non-JSON):', text.slice(0, 300))
  }
}

async function main() {
  const candidates = [
    `https://zernio.com/api/v1/connect/facebook?profileId=${PROFILE_ID}&redirectUrl=http://localhost:3000/api/social/connect/facebook/callback`,
    `https://zernio.com/api/v1/connect/facebook?profileId=${PROFILE_ID}&redirect_uri=http://localhost:3000/api/social/connect/facebook/callback`,
    `https://zernio.com/api/v1/connect/facebook?profileId=${PROFILE_ID}&returnUrl=http://localhost:3000/api/social/connect/facebook/callback`,
    `https://zernio.com/api/v1/connect/facebook?profileId=${PROFILE_ID}&callbackUrl=http://localhost:3000/api/social/connect/facebook/callback`,
  ]
  for (const url of candidates) await attempt(url, url)
}
main()
