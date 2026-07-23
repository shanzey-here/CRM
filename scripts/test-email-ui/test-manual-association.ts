import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
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
  await authClient.auth.signInWithPassword({ email: 'dispatcher@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  console.log('=== Search for an existing contact ===')
  const searchResponse = await fetch('http://localhost:3000/api/testassociate', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query: 'Alice' }),
  })
  const searchResult = await searchResponse.json()
  console.log(JSON.stringify(searchResult, null, 2))

  console.log('\n=== Create a new contact and link it to the thread ===')
  const createResponse = await fetch('http://localhost:3000/api/testassociate', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', threadId: THREAD_ID, firstName: 'Saturday', lastName: 'Mover', email: 'saturday.mover@example-recipient.test' }),
  })
  const createResult = await createResponse.json()
  console.log(JSON.stringify(createResult, null, 2))

  // Verify it actually persisted
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: thread } = await service.from('email_threads').select('contact_id').eq('id', THREAD_ID).single()
  const { data: contact } = await service.from('contacts').select('id, first_name, last_name, email').eq('id', thread!.contact_id!).single()
  console.log('\n=== Verified persisted state ===')
  console.log('Thread.contact_id:', thread!.contact_id)
  console.log('Linked contact:', contact)
}

main()
