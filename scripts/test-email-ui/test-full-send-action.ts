import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const THREAD_ID = 'c48ab2ef-e564-42be-80b3-0f6e650a0353'

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

  // Real dispatcher session — proves dispatcher (not just tenant_admin) can send
  await authClient.auth.signInWithPassword({ email: 'dispatcher@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const response = await fetch('http://localhost:3000/api/testsendreply', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId: THREAD_ID, body: 'Full end-to-end test: yes we can do Saturday, see you then!' }),
  })

  const result = await response.json()
  console.log('Full sendReplyAction result (real dispatcher session):')
  console.log(JSON.stringify(result, null, 2))
}

main()
