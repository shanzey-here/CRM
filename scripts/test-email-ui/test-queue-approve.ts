import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const MESSAGE_ID = '7929d999-f2c0-45f6-8aed-8e33579849d2' // "Queue test - routine 1"

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

  const res = await fetch('http://localhost:3000/api/testqueueaction', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'approve',
      messageId: MESSAGE_ID,
      editedBodyText: 'Hi Mahad,\n\nConfirmed — the move is still on for next Tuesday, see you then!\n\n(edited from the review queue)\n\nThe Removals Team',
    }),
  })
  console.log('status:', res.status)
  console.log(JSON.stringify(await res.json(), null, 2))
}
main()
