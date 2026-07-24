import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function signIn(email: string, password: string) {
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => { cookieJar[name] = value }) },
    },
  })
  const { error } = await authClient.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function main() {
  const adminCookie = await signIn('admin@devtest.local', 'DevTest123!')
  const dispatcherCookie = await signIn('dispatcher@devtest.local', 'DevTest123!')

  console.log('=== tenant_admin: GET /office/settings/ai-assistant ===')
  const adminPageRes = await fetch('http://localhost:3000/office/settings/ai-assistant', { headers: { Cookie: adminCookie } })
  console.log('status:', adminPageRes.status)
  const adminHtml = await adminPageRes.text()
  console.log('Contains "AI Assistant" heading?', adminHtml.includes('AI Assistant'))
  console.log('Contains mode selector radios?', adminHtml.includes('ai_quoting_mode'))

  console.log('\n=== tenant_admin: change mode to quote_review via real Server Action ===')
  const changeRes = await fetch('http://localhost:3000/api/testaiassistant', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'quote_review' }),
  })
  console.log('status:', changeRes.status)
  console.log(JSON.stringify(await changeRes.json(), null, 2))

  console.log('\n=== dispatcher: GET /office/settings/ai-assistant (expect redirect) ===')
  const dispatcherPageRes = await fetch('http://localhost:3000/office/settings/ai-assistant', {
    headers: { Cookie: dispatcherCookie },
    redirect: 'manual',
  })
  console.log('status:', dispatcherPageRes.status)
  console.log('location:', dispatcherPageRes.headers.get('location'))
}
main().catch((err) => console.error('FAILED:', err))
