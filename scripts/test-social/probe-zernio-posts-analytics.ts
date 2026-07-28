import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const PROFILE_ID = '6a674be29864163b359b763c'
const ACCOUNT_ID = '6a675e3a542d8bc5a628ba21'

async function tryFetch(label: string, url: string) {
  console.log(`\n=== ${label} ===`)
  console.log('URL:', url)
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${API_KEY}` } })
    const text = await res.text()
    console.log('status:', res.status)
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 3000))
    } catch {
      console.log('(non-JSON response, first 300 chars):', text.slice(0, 300))
    }
  } catch (err) {
    console.log('fetch error:', err)
  }
}

async function main() {
  await tryFetch('GET posts (list)', `https://zernio.com/api/v1/posts?profileId=${PROFILE_ID}`)
  await tryFetch('GET posts (by account)', `https://zernio.com/api/v1/posts?accountId=${ACCOUNT_ID}`)
  await tryFetch('GET analytics (by account)', `https://zernio.com/api/v1/analytics?accountId=${ACCOUNT_ID}`)
  await tryFetch('GET analytics (by profile)', `https://zernio.com/api/v1/analytics?profileId=${PROFILE_ID}`)
}
main()
