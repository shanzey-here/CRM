import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const APPROVE_MESSAGE_ID = 'cf37cf0b-5c03-4341-a157-88135b29633f' // "AI test - assist quote"
const DISCARD_MESSAGE_ID = '295818da-f317-4c75-90b9-0b76e631a259' // "AI test - quote_review routine"

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

  console.log('=== Approving draft with an edited body ===')
  const approveRes = await fetch('http://localhost:3000/api/testaidraft', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'approve',
      messageId: APPROVE_MESSAGE_ID,
      editedBodyText: 'Hi there,\n\nThanks for reaching out — I will personally put together a full quote for your 2-bed move to Leeds and get back to you within 24 hours.\n\nDev Test Removals (edited by human reviewer)',
    }),
  })
  console.log('status:', approveRes.status)
  console.log(JSON.stringify(await approveRes.json(), null, 2))

  console.log('\n=== Discarding a different pending draft ===')
  const discardRes = await fetch('http://localhost:3000/api/testaidraft', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'discard', messageId: DISCARD_MESSAGE_ID }),
  })
  console.log('status:', discardRes.status)
  console.log(JSON.stringify(await discardRes.json(), null, 2))
}
main()
