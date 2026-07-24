import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { maybeDraftAiReply } from '../../src/modules/ai-email/server/orchestrate'

const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
const MAILBOX_ID = '37a0090f-9996-4fee-b513-b0e9fdd9180b'

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function seedInbound(subject: string, bodyText: string) {
  const { data: mailbox } = await service.from('mailboxes').select('*').eq('id', MAILBOX_ID).single()
  const { data: thread } = await service
    .from('email_threads')
    .insert({ tenant_id: TENANT_ID, mailbox_id: MAILBOX_ID, subject, participant_addresses: ['mahad.margoob@gmail.com', mailbox!.mailbox_address] })
    .select('id')
    .single()
  const sourceMessageId = `<qf-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.gmail.com>`
  const { data: inboundMsg } = await service
    .from('email_messages')
    .insert({
      tenant_id: TENANT_ID, thread_id: thread!.id, mailbox_id: MAILBOX_ID, direction: 'inbound',
      from_address: 'mahad.margoob@gmail.com', to_addresses: [mailbox!.mailbox_address], body_text: bodyText,
      received_at: new Date().toISOString(), source_message_id: sourceMessageId, authored_by: 'human', requires_approval: false,
    })
    .select('id')
    .single()

  await maybeDraftAiReply(service as any, mailbox as any, thread!.id, inboundMsg!.id)
  return { threadId: thread!.id, mailbox }
}

async function main() {
  const args = process.argv.slice(2)
  const mode = args[0] // 'quote_review' for approve/discard mix, 'auto_send' for the log test

  await service.from('tenant_settings').update({ ai_quoting_mode: mode }).eq('tenant_id', TENANT_ID)
  console.log('Mode set to:', mode)

  // Incomplete quote-needing message — classify()+extract() only, no
  // draft() call, since it falls back to the fixed clarifying-reply
  // template. This is how we generate real test data without touching the
  // exhausted draft-model quota.
  const { threadId } = await seedInbound(
    `Quota-free test - ${mode} - ${Date.now()}`,
    'Hi, what would it cost to move to Leeds?'
  )
  console.log('Seeded thread:', threadId)

  const { data: result } = await service
    .from('email_messages')
    .select('id, authored_by, requires_approval, body_text, ai_metadata')
    .eq('thread_id', threadId)
    .eq('direction', 'outbound')
    .maybeSingle()
  console.log(JSON.stringify(result, null, 2))
}
main().catch((err) => console.error('FAILED:', err))
