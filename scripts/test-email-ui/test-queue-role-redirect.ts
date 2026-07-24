import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function checkAccess(label: string, email: string, password: string) {
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) },
      setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => { cookieJar[name] = value }) },
    },
  })
  const { data, error } = await authClient.auth.signInWithPassword({ email, password })
  if (error) { console.log(`${label}: sign-in failed — ${error.message}`); return }
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const res = await fetch('http://localhost:3000/office/email/review-queue', { headers: { Cookie: cookieHeader }, redirect: 'manual' })
  console.log(`${label} (role=${data.user?.app_metadata?.tenant_role}): status=${res.status}, location=${res.headers.get('location') ?? 'n/a'}`)
}

async function main() {
  await checkAccess('tenant_admin', 'admin@devtest.local', 'DevTest123!')
  await checkAccess('dispatcher', 'dispatcher@devtest.local', 'DevTest123!')
  await checkAccess('crew', 'crew@devtest.local', 'DevTest123!')
  await checkAccess('customer', 'customer@devtest.local', 'DevTest123!')
}
main()
