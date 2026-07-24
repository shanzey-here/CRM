import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`)
  const data = await res.json()
  if (!res.ok) {
    console.log('ERROR', res.status, JSON.stringify(data, null, 2))
    return
  }
  const names = (data.models ?? [])
    .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m: any) => m.name)
  console.log(names.join('\n'))
}
main()
