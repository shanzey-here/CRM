import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function main() {
  // Create a real broken mailbox row for the real dev-test-removals tenant
  const { data: broken, error: brokenErr } = await service
    .from('mailboxes')
    .upsert(
      {
        tenant_id: TENANT_A,
        provider: 'imap_generic',
        connection_method: 'imap_password',
        mailbox_address: 'ui-render-test@dev-test-removals.example',
        is_active: false,
        last_sync_error: 'IMAP login failed — check the username and password, then reconnect this mailbox',
      },
      { onConflict: 'tenant_id,mailbox_address' }
    )
    .select('id')
    .single()
  if (brokenErr) throw brokenErr
  console.log('Broken mailbox row created:', broken!.id)

  // Real tenant_admin session, real cookie-authenticated request to the real page
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
  await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

  console.log('\nCookie header being sent:', cookieHeader.slice(0, 60), '...')

  const response = await fetch('http://localhost:3000/office/settings/mailboxes', { headers: { Cookie: cookieHeader } })
  const html = await response.text()

  console.log('\nFinal response URL (after any redirects):', response.url)
  console.log('Page status:', response.status)
  console.log('Contains the broken mailbox address?', html.includes('ui-render-test@dev-test-removals.example'))
  console.log('Contains the human-readable error message?', html.includes('IMAP login failed'))
  console.log('Contains a Reconnect link?', html.includes('>Reconnect<') || html.includes('Reconnect via the IMAP form'))
  console.log('Contains "No mailboxes connected" (empty state)?', html.includes('No mailboxes connected'))

  const fs = await import('fs')
  fs.writeFileSync('./scratch-response.html', html)
  console.log('Saved full response to ./scratch-response.html')

  await service.from('mailboxes').delete().eq('id', broken!.id)
  console.log('\nCleaned up test mailbox')
}

main()
