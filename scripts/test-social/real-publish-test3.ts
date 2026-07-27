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
  let parsed: any = null
  try {
    parsed = JSON.parse(text)
    console.log(JSON.stringify(parsed, null, 2))
  } catch {
    console.log('(non-JSON):', text.slice(0, 500))
  }
  return parsed
}

async function main() {
  const testContent = `Real API integration test #2 from Gomove CRM — platforms+profileId schema. ${new Date().toISOString()}`

  const result = await attempt('profileId + platforms array', {
    content: testContent,
    profileId: PROFILE_ID,
    platforms: ['facebook'],
  })

  console.log('\nResulting status field:', result?.post?.status)
  console.log('Resulting platforms field:', JSON.stringify(result?.post?.platforms))
}
main()
