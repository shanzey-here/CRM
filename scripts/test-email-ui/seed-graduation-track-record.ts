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

async function seedPendingDraft(subject: string, bodyText: string): Promise<string> {
  const { data: mailbox } = await service.from('mailboxes').select('*').eq('id', MAILBOX_ID).single()
  const { data: thread } = await service
    .from('email_threads')
    .insert({ tenant_id: TENANT_ID, mailbox_id: MAILBOX_ID, subject, participant_addresses: ['mahad.margoob@gmail.com', mailbox!.mailbox_address] })
    .select('id')
    .single()
  const sourceMessageId = `<grad-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.gmail.com>`
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

  const { data: draft } = await service
    .from('email_messages')
    .select('id')
    .eq('thread_id', thread!.id)
    .eq('authored_by', 'ai_draft_pending')
    .single()
  return draft!.id
}

async function main() {
  await service.from('tenant_settings').update({ ai_quoting_mode: 'quote_review' }).eq('tenant_id', TENANT_ID)

  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJar[name] = value }) } },
  })
  await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  async function callAction(payload: any) {
    const res = await fetch('http://localhost:3000/api/testautosend', {
      method: 'POST', headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    return res.json()
  }

  const routineMessages = [
    'Hi, just confirming the move is still on for the 15th.',
    'Hi, thanks for the quick reply yesterday, much appreciated.',
    'Hi, can you confirm the crew arrival time on moving day?',
    'Hi, just checking in on the schedule for next week.',
    'Hi, wanted to say the last update was really helpful, thanks.',
  ]

  console.log('Seeding 18 unedited approvals...')
  for (let i = 0; i < 18; i++) {
    const messageId = await seedPendingDraft(`Grad test - unedited ${i + 1}`, routineMessages[i % routineMessages.length])
    const result = await callAction({ action: 'approve', messageId })
    console.log(`  [${i + 1}/18] approve (unedited):`, JSON.stringify(result))
  }

  console.log('Seeding 1 edited approval...')
  {
    const messageId = await seedPendingDraft('Grad test - edited 1', 'Hi, just confirming the move is still on for the 15th.')
    const result = await callAction({ action: 'approve', messageId, editedBodyText: 'Hi Mahad,\n\nConfirmed for the 15th — see you then!\n\n(edited by dispatcher)\n\nThe Removals Team' })
    console.log('  approve (edited):', JSON.stringify(result))
  }

  console.log('Seeding 1 discard...')
  {
    const messageId = await seedPendingDraft('Grad test - discarded 1', 'Hi, just confirming the move is still on for the 15th.')
    const result = await callAction({ action: 'discard', messageId })
    console.log('  discard:', JSON.stringify(result))
  }

  console.log('\nDone seeding.')
}
main().catch((err) => console.error('FAILED:', err))
