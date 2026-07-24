import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const PENDING_THREAD_ID = '09b9422d-9200-43ef-bdc2-a1da7f653e0e' // AI test - render check pending
const SENT_THREAD_ID = 'fa6eaafe-7ed9-4578-b89b-cbf9708151e5' // AI test - assist routine

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

  console.log('=== Pending draft thread ===')
  const pendingRes = await fetch(`http://localhost:3000/office/email/${PENDING_THREAD_ID}`, { headers: { Cookie: cookieHeader } })
  const pendingHtml = await pendingRes.text()
  console.log('status:', pendingRes.status)
  console.log('Contains amber "AI draft — awaiting approval" badge text?', pendingHtml.includes('AI draft'))
  console.log('Contains amber badge classes (bg-amber-50)?', pendingHtml.includes('bg-amber-50'))
  console.log('Contains "Approve') /* checking button text presence, may be client-rendered */
  console.log('Contains Approve &amp; Send button markup?', pendingHtml.includes('Approve') && pendingHtml.includes('Discard'))

  console.log('\n=== AI-sent thread ===')
  const sentRes = await fetch(`http://localhost:3000/office/email/${SENT_THREAD_ID}`, { headers: { Cookie: cookieHeader } })
  const sentHtml = await sentRes.text()
  console.log('status:', sentRes.status)
  console.log('Contains purple "AI sent" badge text?', sentHtml.includes('AI sent'))
  console.log('Contains purple badge classes (bg-purple-50)?', sentHtml.includes('bg-purple-50'))
}
main()
