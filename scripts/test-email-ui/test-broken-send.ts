import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BROKEN_THREAD_ID = '888f9f8b-f9a8-48bf-8bcb-1083df799aa5'

async function main() {
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return Object.entries(cookieJar).map(([name, value]) => ({ name, value }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          cookieJar[name] = value
        })
      },
    },
  })
  await authClient.auth.signInWithPassword({ email: 'dispatcher@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const response = await fetch('http://localhost:3000/api/testsendreply', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: BROKEN_THREAD_ID, body: 'This send should fail cleanly.' }),
  })

  const result = await response.json()
  console.log('Send attempt against broken mailbox:')
  console.log(JSON.stringify(result, null, 2))
  console.log('\nHTTP status (must be 200 - a failed send is a normal response, not a server error):', response.status)
}

main()
