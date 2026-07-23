import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const THREAD_ID = 'c48ab2ef-e564-42be-80b3-0f6e650a0353'

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
  if (error) throw new Error(`Sign-in failed: ${error.message}`)
  return { cookieHeader: Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; '), role: data.user?.app_metadata?.tenant_role }
}

async function main() {
  const { cookieHeader, role } = await signIn('dispatcher@devtest.local', 'DevTest123!')
  console.log('Signed in as dispatcher, role:', role)

  const response = await fetch(`http://localhost:3000/office/email/${THREAD_ID}`, { headers: { Cookie: cookieHeader } })
  const html = await response.text()

  console.log('\nPage status:', response.status)
  console.log('Final URL:', response.url)
  console.log('Contains inbound message text?', html.includes('Hi, can you confirm a Saturday move is possible?'))
  console.log('Contains outbound reply text?', html.includes('Full end-to-end test: yes we can do Saturday'))
  console.log('Contains "Human" badge?', html.includes('Human'))
  console.log('Contains recipient address (customer@example-recipient.test)?', html.includes('customer@example-recipient.test'))
  console.log('Contains "Unlinked" (thread not yet associated)?', html.includes('Unlinked'))

  const fs = await import('fs')
  fs.writeFileSync('./scratch-thread-page.html', html)
}

main()
