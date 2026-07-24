import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJar[name] = value }) } },
  })
  await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const res = await fetch('http://localhost:3000/office/email/auto-sent-log', { headers: { Cookie: cookieHeader } })
  const html = await res.text()
  console.log('status:', res.status)
  console.log('Contains "Recently Auto-Sent" heading?', html.includes('Recently Auto-Sent'))
  console.log('Contains our quota-free test subject?', html.includes('Quota-free test - auto_send'))
  console.log('Contains "collection address" preview text?', html.includes('collection address'))
}
main()
