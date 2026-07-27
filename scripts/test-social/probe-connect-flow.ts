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
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log('(non-JSON, first 300 chars):', text.slice(0, 300))
  }
}

async function main() {
  await attempt('GET connect facebook', `https://zernio.com/api/v1/connect/facebook?profileId=${PROFILE_ID}`)
  await attempt('GET connect instagram', `https://zernio.com/api/v1/connect/instagram?profileId=${PROFILE_ID}`)
}
main()
