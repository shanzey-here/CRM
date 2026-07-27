import { config } from 'dotenv'
config({ path: '.env.local' })

const API_KEY = process.env.ZERNIO_API_KEY!
const POST_ID = process.argv[2] || '6a676364c9752e00f2c2c190'

async function main() {
  const res = await fetch(`https://zernio.com/api/v1/posts/${POST_ID}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  const text = await res.text()
  console.log('status:', res.status)
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2))
  } catch {
    console.log('(non-JSON):', text.slice(0, 300))
  }
}
main()
