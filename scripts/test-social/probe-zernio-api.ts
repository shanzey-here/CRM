// One-off probe against the REAL live Zernio API — verifying real behavior
// before building the adapter around it, per this project's established
// "trust the live system over scraped docs" standard.
import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const PROFILE_ID = '6a674be29864163b359b763c'

async function tryFetch(label: string, url: string) {
  console.log(`\n=== ${label} ===`)
  console.log('URL:', url)
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
    const text = await res.text()
    console.log('status:', res.status)
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2))
    } catch {
      console.log('(non-JSON response, first 500 chars):', text.slice(0, 500))
    }
  } catch (err) {
    console.log('fetch error:', err)
  }
}

async function main() {
  await tryFetch('GET profile', `https://zernio.com/api/v1/profiles/${PROFILE_ID}`)
  await tryFetch('GET accounts (query param)', `https://zernio.com/api/v1/accounts?profileId=${PROFILE_ID}`)
  await tryFetch('GET profile accounts (nested)', `https://zernio.com/api/v1/profiles/${PROFILE_ID}/accounts`)
  await tryFetch('GET all profiles', `https://zernio.com/api/v1/profiles`)
}
main()
