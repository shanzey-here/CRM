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
    console.log('(non-JSON):', text.slice(0, 300))
  }
  return { status: res.status, parsed }
}

async function main() {
  const base = { profileId: PROFILE_ID }

  const r1 = await attempt('platforms: [{accountId}]', {
    ...base,
    content: `Test #3 - accountId object. ${new Date().toISOString()}`,
    platforms: [{ accountId: ACCOUNT_ID }],
  })
  if (r1.status >= 200 && r1.status < 300 && r1.parsed?.post?.status !== 'draft') return

  const r2 = await attempt('platforms: [{platform, accountId}]', {
    ...base,
    content: `Test #4 - platform+accountId object. ${new Date().toISOString()}`,
    platforms: [{ platform: 'facebook', accountId: ACCOUNT_ID }],
  })
  if (r2.status >= 200 && r2.status < 300 && r2.parsed?.post?.status !== 'draft') return

  await attempt('platforms: [{platform, accountIds}]', {
    ...base,
    content: `Test #5 - platform+accountIds array in object. ${new Date().toISOString()}`,
    platforms: [{ platform: 'facebook', accountIds: [ACCOUNT_ID] }],
  })
}
main()
