import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const THREADS = [
  { id: '09b9422d-9200-43ef-bdc2-a1da7f653e0e', subject: 'AI test - render check pending', expectQuote: false },
  { id: '151e0e25-577d-4a68-8076-2c2f5e262c77', subject: 'Quote test - full detail', expectQuote: false },
  { id: '6b556308-3efc-4d0d-8993-44fb40ea6ec2', subject: 'Quote test - full detail 2', expectQuote: true },
  { id: '9cec79ce-92fa-4f56-b420-ae2767ae25f1', subject: 'Quote test - incomplete detail', expectQuote: false },
  { id: '26b682f6-79a4-435e-ade6-9df1b1b45e29', subject: 'Queue test - routine 1', expectQuote: false },
  { id: '9291f3ee-e69f-457f-bced-1f2e8561211b', subject: 'Queue test - routine 2', expectQuote: false },
  { id: '33927e57-87a5-4861-a383-0c5f34fb66ef', subject: 'Queue test - quote 1', expectQuote: true },
  { id: '77e8b18d-4f80-4658-ae67-0c0e57b04151', subject: 'Queue test - quote 2', expectQuote: true },
]

async function main() {
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => { cookieJar[name] = value }) },
    },
  })
  await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const res = await fetch('http://localhost:3000/office/email/review-queue', { headers: { Cookie: cookieHeader } })
  const html = await res.text()

  for (const t of THREADS) {
    const linkStr = `/office/email/${t.id}`
    const idx = html.indexOf(linkStr)
    if (idx === -1) {
      console.log(`MISSING from page: ${t.subject}`)
      continue
    }
    // Look at the 400 chars BEFORE this link (the row's badge is rendered before the link in our markup).
    const windowBefore = html.slice(Math.max(0, idx - 600), idx)
    const hasQuoteBadge = windowBefore.includes('Quote —')
    const hasRoutineBadge = windowBefore.includes('>AI draft<')
    console.log(`${t.subject}: expectQuote=${t.expectQuote} | hasQuoteBadge=${hasQuoteBadge} | hasRoutineBadge=${hasRoutineBadge} | ${hasQuoteBadge === t.expectQuote && hasRoutineBadge !== t.expectQuote ? 'PASS' : 'CHECK'}`)
  }
}
main()
