import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

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
  console.log('status:', res.status)

  // Extract subject-line order as they appear in the rendered HTML to prove real ordering.
  const subjectMatches = [...html.matchAll(/text-xs text-slate-500 mt-0\.5 truncate">\s*([^<]+?)\s*</g)].map((m) => m[1])
  console.log('\nSubjects in render order:')
  subjectMatches.forEach((s, i) => console.log(`${i + 1}. ${s}`))

  console.log('\nContains "Quote —" badge (quote-bearing)?', html.includes('Quote —'))
  console.log('Contains "AI draft" badge (routine)?', html.includes('>AI draft<'))
  console.log('Count of "Quote —" occurrences:', (html.match(/Quote —/g) || []).length)
  console.log('Count of ">AI draft<" occurrences:', (html.match(/>AI draft</g) || []).length)
  console.log('Contains "View full thread" links?', (html.match(/View full thread/g) || []).length)
}
main()
