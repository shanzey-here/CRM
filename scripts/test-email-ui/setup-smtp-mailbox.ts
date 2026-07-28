import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function main() {
  const { createImapMailbox } = await import('../../src/modules/mailboxes/server/repository')

  const { data: mailbox, error } = await createImapMailbox(supabase, TENANT_A, {
    mailboxAddress: 'yyhkkbgzmavyqmaq@ethereal.email',
    host: 'imap.ethereal.email',
    port: 993,
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
    password: 'wwJTzKAvYVsTDbdHUX',
  })

  if (error) throw error
  console.log('Real SMTP-connected mailbox created:', mailbox)

  // Create a real thread + a real inbound message to reply to
  const { data: thread } = await supabase
    .from('email_threads')
    .insert({
      tenant_id: TENANT_A,
      mailbox_id: mailbox!.id,
      subject: 'Question about a Saturday move',
      participant_addresses: ['customer@example-recipient.test', 'yyhkkbgzmavyqmaq@ethereal.email'],
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const { data: inboundMessage } = await supabase
    .from('email_messages')
    .insert({
      tenant_id: TENANT_A,
      thread_id: thread!.id,
      mailbox_id: mailbox!.id,
      direction: 'inbound',
      from_address: 'customer@example-recipient.test',
      to_addresses: ['yyhkkbgzmavyqmaq@ethereal.email'],
      body_text: 'Hi, can you confirm a Saturday move is possible?',
      received_at: new Date().toISOString(),
      source_message_id: `<original-${Date.now()}@example-recipient.test>`,
      authored_by: 'human',
      requires_approval: false,
    })
    .select('id')
    .single()

  console.log('\nThread created:', thread!.id)
  console.log('Inbound message created:', inboundMessage!.id)
  console.log('\nMAILBOX_ID=' + mailbox!.id)
  console.log('THREAD_ID=' + thread!.id)
}

main()
