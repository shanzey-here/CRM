import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const PROFILE_ID = '6a674be29864163b359b763c'
const ACCOUNT_ID = '6a675e3a542d8bc5a628ba21'

async function main() {
  const content = `Real API integration test from Gomove CRM (feature/phase2-social-aggregator-integration) — verifying real publish via Zernio, publishNow:true. ${new Date().toISOString()}`
  const body = {
    profileId: PROFILE_ID,
    content,
    platforms: [{ platform: 'facebook', accountId: ACCOUNT_ID }],
    publishNow: true,
  }
  console.log('Body:', JSON.stringify(body))

  const res = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  console.log('status:', res.status)
  console.log(JSON.stringify(data, null, 2))
}
main()
