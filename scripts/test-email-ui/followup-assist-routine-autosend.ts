// FOLLOW-UP for feature/phase2-email-auto-send — run this once the Gemini
// draft() model's quota is available again (or with a working API key).
// Seeds one real routine (non-quote-needing) inbound message under `assist`
// mode — this is the one case that genuinely requires a real draft() call
// (no quota-free template path exists for it, unlike the quote-needing/
// incomplete-extraction case already proven in this branch's other tests).
// It should land as a real ai_sent row with ai_metadata.autoSent: true,
// alongside the auto_send-mode row already proven in this branch. Then
// reload /office/email/auto-sent-log as admin@devtest.local and confirm
// BOTH rows render together, correctly badge-distinguished.
//
// Usage: npx tsx scripts/test-email-ui/followup-assist-routine-autosend.ts

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { maybeDraftAiReply } from '../../src/modules/ai-email/server/orchestrate'

const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1' // same tenant as the existing auto_send-mode row
const MAILBOX_ID = '37a0090f-9996-4fee-b513-b0e9fdd9180b'

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  await service.from('tenant_settings').update({ ai_quoting_mode: 'assist' }).eq('tenant_id', TENANT_ID)
  console.log('Mode set to: assist')

  const { data: mailbox } = await service.from('mailboxes').select('*').eq('id', MAILBOX_ID).single()
  const { data: thread } = await service
    .from('email_threads')
    .insert({ tenant_id: TENANT_ID, mailbox_id: MAILBOX_ID, subject: `Followup test - assist routine - ${Date.now()}`, participant_addresses: ['mahad.margoob@gmail.com', mailbox!.mailbox_address] })
    .select('id')
    .single()
  const sourceMessageId = `<followup-${Date.now()}-${Math.random().toString(36).slice(2)}@mail.gmail.com>`
  const { data: inboundMsg } = await service
    .from('email_messages')
    .insert({
      tenant_id: TENANT_ID, thread_id: thread!.id, mailbox_id: MAILBOX_ID, direction: 'inbound',
      from_address: 'mahad.margoob@gmail.com', to_addresses: [mailbox!.mailbox_address],
      body_text: 'Hi, just confirming everything is still on track for the move.',
      received_at: new Date().toISOString(), source_message_id: sourceMessageId, authored_by: 'human', requires_approval: false,
    })
    .select('id')
    .single()

  await maybeDraftAiReply(service as any, mailbox as any, thread!.id, inboundMsg!.id)

  const { data: result } = await service
    .from('email_messages')
    .select('id, authored_by, requires_approval, ai_metadata')
    .eq('thread_id', thread!.id)
    .eq('direction', 'outbound')
    .maybeSingle()
  console.log('Result row:', JSON.stringify(result, null, 2))

  if (result?.authored_by !== 'ai_sent' || !(result.ai_metadata as any)?.autoSent) {
    console.error('UNEXPECTED: did not produce a real ai_sent row with autoSent:true — check draft() quota again.')
    return
  }

  // Render the real audit log page as admin@devtest.local and confirm both rows.
  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJar[name] = value }) } },
  })
  await authClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const res = await fetch('http://localhost:3000/office/email/auto-sent-log', { headers: { Cookie: cookieHeader } })
  const html = await res.text()
  console.log('\nAudit log page status:', res.status)
  console.log('Contains the new assist-mode routine subject?', html.includes('Followup test - assist routine'))
  console.log('Contains the earlier auto_send-mode subject ("Quota-free test - auto_send")?', html.includes('Quota-free test - auto_send'))
  console.log('Contains purple "AI sent" badge (routine)?', html.includes('>AI sent<'))
}
main().catch((err) => console.error('FAILED:', err))
