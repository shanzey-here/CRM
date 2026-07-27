import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const PROFILE_ID = '6a674be29864163b359b763c'
const ACCOUNT_ID = '6a675e3a542d8bc5a628ba21'

async function attempt(label: string, body: Record<string, unknown>) {
  console.log(`\n=== ${label} ===`)
  console.log('Body:', JSON.stringify(body))
  const res = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  console.log('status:', res.status)
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log('(non-JSON):', text.slice(0, 500))
  }
  return { status: res.status, text }
}

async function main() {
  const testContent = `Real API integration test from Gomove CRM (social-aggregator-integration branch) — verifying real publish via Zernio. Timestamp: ${new Date().toISOString()}`

  // Try the most likely schema first.
  const r1 = await attempt('accountIds array', {
    content: testContent,
    accountIds: [ACCOUNT_ID],
  })
  if (r1.status >= 200 && r1.status < 300) return

  const r2 = await attempt('profileId + platforms array', {
    content: testContent,
    profileId: PROFILE_ID,
    platforms: ['facebook'],
  })
  if (r2.status >= 200 && r2.status < 300) return

  await attempt('profileId + accounts array', {
    content: testContent,
    profileId: PROFILE_ID,
    accounts: [ACCOUNT_ID],
  })
}
main()
