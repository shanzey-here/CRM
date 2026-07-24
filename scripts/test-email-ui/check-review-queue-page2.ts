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

  // Count only within the visible HTML body, up to the first <script> tag
  // (RSC hydration payload) to avoid double-counting from the embedded
  // flight-data duplicate.
  const scriptStart = html.indexOf('<script')
  const visibleHtml = scriptStart > -1 ? html.slice(0, scriptStart) : html

  console.log('Full response length:', html.length, '| visible-only length:', visibleHtml.length)
  console.log('textarea count (= number of actionable rows):', (visibleHtml.match(/<textarea/g) || []).length)
  console.log('"Quote —" count (visible only):', (visibleHtml.match(/Quote —/g) || []).length)
  console.log('">AI draft<" count (visible only):', (visibleHtml.match(/>AI draft</g) || []).length)
  console.log('"View full thread" count (visible only):', (visibleHtml.match(/View full thread/g) || []).length)
}
main()
