import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const MESSAGE_ID = '47dac90f-a0a0-46b0-9f98-e41f72ebd448' // "Queue test - quote 1"

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

  console.log('Firing two concurrent approveAiDraftAction calls for the SAME messageId...\n')

  const callApprove = () =>
    fetch('http://localhost:3000/api/testqueueaction', {
      method: 'POST',
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve', messageId: MESSAGE_ID }),
    }).then((r) => r.json())

  const [resultA, resultB] = await Promise.all([callApprove(), callApprove()])

  console.log('Call A result:', JSON.stringify(resultA, null, 2))
  console.log('Call B result:', JSON.stringify(resultB, null, 2))

  const successCount = [resultA, resultB].filter((r) => r.success).length
  console.log('\nNumber of calls that succeeded:', successCount, '(expected: exactly 1)')
}
main()
