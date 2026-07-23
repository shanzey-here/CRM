import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

// Fake-but-syntactically-valid config so getOAuthClient() doesn't reject on
// "not configured". GOOGLE_OAUTH_TOKEN_URL_OVERRIDE points the real token
// exchange at a local server (fake-google-token-server.ts) returning
// Google's actual documented invalid_grant response shape — this exercises
// the real HTTP request/response/error-parsing pipeline, not a reimplementation.
process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id'
process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-client-secret'
process.env.GOOGLE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/oauth/gmail/callback'
process.env.GOOGLE_OAUTH_TOKEN_URL_OVERRIDE = 'http://127.0.0.1:9987/'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('=== Step 1: real getGmailAccessToken() against the real HTTP pipeline, fake token endpoint returning invalid_grant ===')
  const { getGmailAccessToken } = await import('../../src/modules/mailboxes/server/gmail-oauth')
  const result = await getGmailAccessToken('fake-refresh-token')
  console.log('Result:', result)
  console.log('Correctly classified as revoked?', 'revoked' in result && result.revoked === true)

  console.log('\n=== Step 2: full sync worker run, real Gmail mailbox row hitting the same stub ===')
  const { encryptCredential } = await import('../../src/modules/mailboxes/server/credential-crypto')
  const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  // A real Gmail-configured mailbox row with an encrypted (fake) refresh token
  const encrypted = encryptCredential('fake-refresh-token')
  const toBytea = (buf: Buffer) => '\\x' + buf.toString('hex')
  const { data: gmailMailbox } = await supabase
    .from('mailboxes')
    .upsert(
      {
        tenant_id: TENANT_A,
        provider: 'gmail',
        connection_method: 'oauth',
        mailbox_address: 'revoked-test@gmail.example',
        encrypted_credential: toBytea(encrypted),
        is_active: true,
        last_sync_error: null,
      },
      { onConflict: 'tenant_id,mailbox_address' }
    )
    .select('id')
    .single()
  console.log('Gmail mailbox created:', gmailMailbox!.id)

  const { data: beforeState } = await supabase
    .from('mailboxes')
    .select('id, is_active, last_sync_error')
    .eq('id', gmailMailbox!.id)
    .single()
  console.log('\nBEFORE sync:')
  console.log(beforeState)

  // A second, healthy IMAP mailbox in the same run to prove isolation —
  // real hoodiecrow instance on 1143.
  const { createImapMailbox } = await import('../../src/modules/mailboxes/server/repository')
  const { data: healthyMailbox, error: healthyErr } = await createImapMailbox(supabase, TENANT_A, {
    mailboxAddress: 'support@dev-test-removals.example',
    host: '127.0.0.1',
    port: 1143,
    password: 'testpass',
  })
  if (healthyErr) throw healthyErr
  console.log('Healthy IMAP mailbox created:', healthyMailbox!.id)

  const { runMailboxSync } = await import('../../src/modules/mailboxes/server/sync')
  const syncResult = await runMailboxSync(supabase as any)
  console.log('\nSync run result:')
  console.log(JSON.stringify(syncResult, null, 2))

  const { data: mailboxState } = await supabase
    .from('mailboxes')
    .select('id, is_active, last_sync_error')
    .eq('id', gmailMailbox!.id)
    .single()
  console.log('\nGmail mailbox state after sync (must be inactive with a clear, human-readable error):')
  console.log(mailboxState)

  const { data: healthyState } = await supabase
    .from('mailboxes')
    .select('id, is_active, last_sync_error, last_synced_at')
    .eq('id', healthyMailbox!.id)
    .single()
  console.log('\nHealthy IMAP mailbox state after the SAME run (must be unaffected):')
  console.log(healthyState)

  // Cleanup
  await supabase.from('mailboxes').delete().eq('id', gmailMailbox!.id)
  await supabase.from('mailboxes').delete().eq('id', healthyMailbox!.id)
  console.log('\nCleaned up test mailboxes')
}

main()
