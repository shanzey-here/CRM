// Reusable scenario runner for ai-email-draft verification.
// Usage: npx tsx scripts/test-email-ui/ai-draft-scenario.ts <mode> <subject> <bodyText>
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { maybeDraftAiReply } from '../../src/modules/ai-email/server/orchestrate'

const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
const MAILBOX_ID = '37a0090f-9996-4fee-b513-b0e9fdd9180b'

async function main() {
  const [, , mode, subject, ...bodyParts] = process.argv
  const bodyText = bodyParts.join(' ')
  if (!mode || !subject || !bodyText) {
    console.error('Usage: ai-draft-scenario.ts <mode> <subject> <bodyText>')
    process.exit(1)
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Set the tenant's ai_quoting_mode for this scenario.
  const { error: modeErr } = await supabase.from('tenant_settings').update({ ai_quoting_mode: mode }).eq('tenant_id', TENANT_ID)
  if (modeErr) throw new Error(`Failed to set mode: ${modeErr.message}`)
  console.log(`Set ai_quoting_mode = '${mode}' for tenant ${TENANT_ID}`)

  const { data: mailbox, error: mailboxErr } = await supabase.from('mailboxes').select('*').eq('id', MAILBOX_ID).single()
  if (mailboxErr || !mailbox) throw new Error(`Failed to load mailbox: ${mailboxErr?.message}`)

  // Fresh thread per scenario, distinct subject for easy isolation.
  const { data: thread, error: threadErr } = await supabase
    .from('email_threads')
    .insert({
      tenant_id: TENANT_ID,
      mailbox_id: MAILBOX_ID,
      subject,
      participant_addresses: ['mahad.margoob@gmail.com', mailbox.mailbox_address],
    })
    .select('id')
    .single()
  if (threadErr || !thread) throw new Error(`Failed to create thread: ${threadErr?.message}`)
  console.log(`Created thread ${thread.id}`)

  // Seed the inbound message directly — same row shape sync.ts's
  // upsertMessage() would produce. The IMAP/Gmail-fetch leg itself was
  // already exhaustively proven in the imap-sync branch; this branch's new
  // surface is everything downstream of a landed inbound message.
  const sourceMessageId = `<test-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.gmail.com>`
  const { data: inboundMsg, error: inboundErr } = await supabase
    .from('email_messages')
    .insert({
      tenant_id: TENANT_ID,
      thread_id: thread.id,
      mailbox_id: MAILBOX_ID,
      direction: 'inbound',
      from_address: 'mahad.margoob@gmail.com',
      to_addresses: [mailbox.mailbox_address],
      body_text: bodyText,
      received_at: new Date().toISOString(),
      source_message_id: sourceMessageId,
      authored_by: 'human',
      requires_approval: false,
    })
    .select('id')
    .single()
  if (inboundErr || !inboundMsg) throw new Error(`Failed to seed inbound message: ${inboundErr?.message}`)
  console.log(`Seeded inbound message ${inboundMsg.id}: "${bodyText}"`)

  console.log('\n--- Calling maybeDraftAiReply() (the real pipeline) ---')
  await maybeDraftAiReply(supabase as any, mailbox as any, thread.id, inboundMsg.id)

  console.log('\n--- Resulting email_messages for this thread ---')
  const { data: messages } = await supabase
    .from('email_messages')
    .select('id, direction, authored_by, requires_approval, body_text, sent_at, source_message_id, ai_metadata')
    .eq('thread_id', thread.id)
    .order('created_at', { ascending: true })

  console.log(JSON.stringify({ threadId: thread.id, messages }, null, 2))
}
main().catch((err) => {
  console.error('SCENARIO FAILED:', err)
  process.exit(1)
})
