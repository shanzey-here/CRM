import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const DRAFT_ID = '6a6762948eedab4ad65467ab'
const ACCOUNT_ID = '6a675e3a542d8bc5a628ba21'

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
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log('(non-JSON):', text.slice(0, 500))
  }
}

async function main() {
  // Try a dedicated publish action on the existing draft.
  await attempt('POST publish on draft', 'POST', `https://zernio.com/api/v1/posts/${DRAFT_ID}/publish`)
}
main()
