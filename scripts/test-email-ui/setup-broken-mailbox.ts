import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function main() {
  const { createImapMailbox } = await import('../../src/modules/mailboxes/server/repository')

  // Real SMTP host, deliberately wrong password — a genuine auth failure,
  // not a simulated one. Distinct mailbox_address from the healthy test
  // mailbox — createImapMailbox upserts on (tenant_id, mailbox_address), so
  // reusing the same address would overwrite the working mailbox's
  // credentials instead of creating a second, independently-broken one.
  const { data: mailbox, error } = await createImapMailbox(supabase, TENANT_A, {
    mailboxAddress: 'broken-mailbox-test@ethereal.email',
    host: 'imap.ethereal.email',
    port: 993,
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
    password: 'deliberately-wrong-password',
  })
  if (error) throw error

  const { data: thread } = await supabase
    .from('email_threads')
    .insert({
      tenant_id: TENANT_A,
      mailbox_id: mailbox!.id,
      subject: 'Broken mailbox test thread',
      participant_addresses: ['customer@example-recipient.test'],
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  await supabase.from('email_messages').insert({
    tenant_id: TENANT_A,
    thread_id: thread!.id,
    mailbox_id: mailbox!.id,
    direction: 'inbound',
    from_address: 'customer@example-recipient.test',
    to_addresses: ['yyhkkbgzmavyqmaq@ethereal.email'],
    body_text: 'Test message for broken mailbox scenario',
    received_at: new Date().toISOString(),
    source_message_id: `<broken-test-${Date.now()}@example-recipient.test>`,
    authored_by: 'human',
    requires_approval: false,
  })

  console.log('Broken mailbox created:', mailbox!.id)
  console.log('BROKEN_THREAD_ID=' + thread!.id)
}

main()
