import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const PROFILE_ID = '6a674be29864163b359b763c'
const ACCOUNT_ID = '6a675e3a542d8bc5a628ba21'
const EXISTING_DRAFT_ID = '6a676364c9752e00f2c2c190'

async function attempt(label: string, method: string, url: string, body?: Record<string, unknown>) {
  console.log(`\n=== ${label} ===`)
  console.log(method, url, body ? JSON.stringify(body) : '')
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  console.log('status:', res.status)
  try {
    const parsed = JSON.parse(text)
    console.log(JSON.stringify(parsed, null, 2).slice(0, 1500))
    return { httpStatus: res.status, parsed }
  } catch {
    console.log('(non-JSON):', text.slice(0, 300))
    return { httpStatus: res.status, parsed: null }
  }
}

async function main() {
  // Try PATCH on the existing draft with an explicit status.
  await attempt('PATCH status=published', 'PATCH', `https://zernio.com/api/v1/posts/${EXISTING_DRAFT_ID}`, { status: 'published' })

  // Try create with explicit status field.
  await attempt('CREATE with status=published', 'POST', 'https://zernio.com/api/v1/posts', {
    profileId: PROFILE_ID,
    content: `Test #6 - explicit status=published. ${new Date().toISOString()}`,
    platforms: [{ platform: 'facebook', accountId: ACCOUNT_ID }],
    status: 'published',
  })

  // Try a dedicated /publish-now style endpoint.
  await attempt('POST /posts/publish-now', 'POST', 'https://zernio.com/api/v1/posts/publish-now', {
    profileId: PROFILE_ID,
    content: `Test #7 - publish-now endpoint. ${new Date().toISOString()}`,
    platforms: [{ platform: 'facebook', accountId: ACCOUNT_ID }],
  })
}
main()
