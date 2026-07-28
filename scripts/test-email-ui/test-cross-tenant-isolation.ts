import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function signIn(email: string, password: string) {
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
  const { data, error } = await authClient.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return { cookieHeader: Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; '), tenantId: data.user?.app_metadata?.tenant_id }
}

async function main() {
  const tenantA = await signIn('dispatcher@devtest.local', 'DevTest123!')
  const tenantB = await signIn('dispatcher-b-inbox@emailtest.local', 'DevTest123!')

  console.log('Tenant A id:', tenantA.tenantId)
  console.log('Tenant B id:', tenantB.tenantId)

  const responseA = await fetch('http://localhost:3000/office/email', { headers: { Cookie: tenantA.cookieHeader } })
  const htmlA = await responseA.text()
  console.log('\n=== Tenant A viewing /office/email ===')
  console.log('Status:', responseA.status)
  console.log('Contains Tenant B\'s private subject?', htmlA.includes('Tenant B private thread'))
  console.log('Contains Tenant A\'s own thread subject?', htmlA.includes('Question about a Saturday move'))

  const responseB = await fetch('http://localhost:3000/office/email', { headers: { Cookie: tenantB.cookieHeader } })
  const htmlB = await responseB.text()
  console.log('\n=== Tenant B viewing /office/email ===')
  console.log('Status:', responseB.status)
  console.log('Contains Tenant B\'s own private subject?', htmlB.includes('Tenant B private thread'))
  console.log('Contains Tenant A\'s thread subject (must be false)?', htmlB.includes('Question about a Saturday move'))

  // Direct-URL access attempt: can Tenant A's dispatcher open Tenant B's thread by guessing/knowing the ID?
  const THREAD_B_ID = '0f8540bf-987c-4cda-8ba3-cd3fe73c24b1'
  const directAccess = await fetch(`http://localhost:3000/office/email/${THREAD_B_ID}`, { headers: { Cookie: tenantA.cookieHeader } })
  console.log('\n=== Tenant A directly requesting Tenant B\'s thread URL ===')
  console.log('Status (must be 404, not 200 with B\'s content):', directAccess.status)
}

main()
