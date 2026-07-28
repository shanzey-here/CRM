import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const THREAD_ID = '2a8948cf-ad13-49df-94bb-385d6d6c897c' // "Testing mail 1" thread, Gmail-connected mailbox

async function main() {
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => { cookieJar[name] = value }) },
    },
  })
  const { error } = await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (error) { console.log('sign-in failed:', error.message); return }
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const bodyText = `Real Gmail send path test — sent via CRM Send Reply button (script-invoked action) at ${new Date().toISOString()}`

  const res = await fetch('http://localhost:3000/api/testsendreply', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: THREAD_ID, bodyText }),
  })
  const result = await res.json()
  console.log('status:', res.status)
  console.log('result:', JSON.stringify(result, null, 2))
}
main()
