import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function signInAndGetCookies(email: string, password: string) {
  const cookieJar: Record<string, string> = {}
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  const cookieHeader = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
  return { cookieHeader, role: data.user?.app_metadata?.tenant_role }
}

async function main() {
  const dispatcher = await signInAndGetCookies('dispatcher@devtest.local', 'DevTest123!')
  console.log('Dispatcher role:', dispatcher.role)
  const dispatcherResponse = await fetch('http://localhost:3000/api/oauth/gmail/start', {
    headers: { Cookie: dispatcher.cookieHeader },
    redirect: 'manual',
  })
  console.log('Dispatcher hitting /api/oauth/gmail/start -> status:', dispatcherResponse.status)
  if (dispatcherResponse.status !== 307 && dispatcherResponse.status !== 302) {
    console.log('  body:', await dispatcherResponse.text())
  }

  const admin = await signInAndGetCookies('admin@devtest.local', 'DevTest123!')
  console.log('\nAdmin role:', admin.role)
  const adminResponse = await fetch('http://localhost:3000/api/oauth/gmail/start', {
    headers: { Cookie: admin.cookieHeader },
    redirect: 'manual',
  })
  console.log('Admin hitting /api/oauth/gmail/start -> status:', adminResponse.status)
  console.log('  Location header:', adminResponse.headers.get('location'))
  console.log('  body:', await adminResponse.text())
}

main()
