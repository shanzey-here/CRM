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
  const { error } = await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (error) { console.log('sign-in failed:', error.message); return }
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const res = await fetch('http://localhost:3000/api/oauth/gmail/start', { headers: { Cookie: cookieHeader }, redirect: 'manual' })
  console.log('status:', res.status)
  console.log('location:', res.headers.get('location'))
}
main()
