import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Json } from '@/types/database.types'
import { buildOutboundMessage, sendMessage } from '@/modules/mailboxes/server/send'
import { getLlmAdapter } from '../provider'
import { buildSystemPrompt } from './persona'
import { getToneSamples } from './tone'
import { generateDraftReply, buildHoldingReply } from './draft'
import { resolveDraftOutcome } from './gate'

type MailboxRow = Database['public']['Tables']['mailboxes']['Row']
type EmailMessageRow = Database['public']['Tables']['email_messages']['Row']

const PROMPT_VERSION = 'v1'

function formatThreadText(messages: Pick<EmailMessageRow, 'direction' | 'from_address' | 'body_text' | 'occurred_at'>[]): string {
  return messages
    .map((m) => `[${m.direction === 'inbound' ? 'Customer' : 'Business'} — ${m.from_address}]\n${m.body_text ?? '(no text)'}`)
    .join('\n\n---\n\n')
}

// The single entry point, called inline from the sync worker right after a
// new inbound message is upserted. Never throws — a drafting failure must
// never break the sync worker or lose the real inbound message, which is
// already safely persisted before this runs. Best-effort side-append only.
export async function maybeDraftAiReply(
  serviceClient: SupabaseClient<Database>,
  mailbox: MailboxRow,
  threadId: string,
  newMessageId: string
): Promise<void> {
  try {
    console.log(`[ai-email] Evaluating thread ${threadId} after new message ${newMessageId}`)

    // A mailbox with no address can't be replied to or drafted for at all —
    // matches sync.ts's own precondition (Gmail/IMAP sync already requires
    // mailbox_address to function).
    if (!mailbox.mailbox_address) return
    const mailboxAddress = mailbox.mailbox_address

    const { data: tenantSettings } = await serviceClient
      .from('tenant_settings')
      .select('*')
      .eq('tenant_id', mailbox.tenant_id)
      .maybeSingle()

    const mode = tenantSettings?.ai_quoting_mode ?? 'off'
    if (mode === 'off') return // Zero LLM calls, zero new rows — the whole mechanism never runs.

    const { data: thread } = await serviceClient
      .from('email_threads')
      .select('id, subject, provider_thread_id')
      .eq('id', threadId)
      .single()
    if (!thread) return

    const { data: threadMessages } = await serviceClient
      .from('email_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('occurred_at', { ascending: true, nullsFirst: false })
    if (!threadMessages || threadMessages.length === 0) return

    const lastInbound = [...threadMessages].reverse().find((m) => m.direction === 'inbound')
    if (!lastInbound) return // Nothing to reply to — the new message wasn't inbound, or thread has no customer message.

    const toAddress = lastInbound.from_address
    const recipientName = toAddress.split('@')[0]

    const { data: pricingSettings } = await serviceClient
      .from('pricing_settings')
      .select('*')
      .eq('tenant_id', mailbox.tenant_id)
      .maybeSingle()

    const systemPrompt = buildSystemPrompt(tenantSettings, pricingSettings)
    const threadText = formatThreadText(threadMessages)
    const toneSamples = await getToneSamples(serviceClient, mailbox.tenant_id, mailbox.id)

    const adapter = getLlmAdapter()

    let needsQuote: boolean
    let classifyModel: string
    try {
      const classifyResult = await adapter.classify({ systemPrompt, threadText })
      needsQuote = classifyResult.needsQuote
      classifyModel = classifyResult.model
    } catch (err) {
      // Fail-safe: an unreadable/errored classification always defaults to
      // "needs review," never to an under-classified auto-send.
      console.error('[ai-email] classify() failed, defaulting to needsQuote=true:', err)
      needsQuote = true
      classifyModel = 'unknown'
    }

    const companyName = tenantSettings?.company_legal_name || mailboxAddress
    let bodyText: string
    let draftModel: string | null
    if (needsQuote) {
      bodyText = buildHoldingReply({ companyName, recipientName })
      draftModel = null
    } else {
      const draftResult = await generateDraftReply(adapter, { systemPrompt, threadText, toneSamples })
      bodyText = draftResult.bodyText
      draftModel = draftResult.model
    }

    const outcome = resolveDraftOutcome(mode, needsQuote)

    const aiMetadata: Json = {
      model: draftModel ?? classifyModel,
      promptVersion: PROMPT_VERSION,
      needsQuote,
      holdingReply: needsQuote,
      knownGap: outcome.isKnownGap,
    }

    if (outcome.autoSend) {
      const messageIds = threadMessages.map((m) => m.source_message_id).filter((id): id is string => !!id)
      const inReplyTo = messageIds.length > 0 ? messageIds[messageIds.length - 1] : null
      const references = messageIds.length > 0 ? messageIds.join(' ') : null

      const { raw, messageId } = buildOutboundMessage({
        from: mailboxAddress,
        to: toAddress,
        subject: thread.subject || '(no subject)',
        bodyText,
        inReplyTo,
        references,
      })

      const sendResult = await sendMessage(serviceClient, mailbox, raw, thread.provider_thread_id, toAddress)
      if (!sendResult.ok) {
        console.error('[ai-email] auto-send failed:', sendResult.error)
        return // Never sent — nothing to record. Safe no-op, matching sendReplyAction's own failure handling.
      }

      const insertRow = {
        tenant_id: mailbox.tenant_id,
        thread_id: threadId,
        mailbox_id: mailbox.id,
        direction: 'outbound' as const,
        from_address: mailboxAddress,
        to_addresses: [toAddress],
        body_text: bodyText,
        sent_at: new Date().toISOString(),
        source_message_id: sendResult.sourceMessageId ?? messageId,
        authored_by: 'ai_sent' as const,
        requires_approval: false,
        ai_metadata: aiMetadata,
      }

      // Sent for real — from here on, a record-keeping failure must never
      // be treated as a send failure (same invariant as sendReplyAction).
      const { error: insertErr } = await serviceClient
        .from('email_messages')
        .upsert(insertRow, { onConflict: 'tenant_id,mailbox_id,source_message_id', ignoreDuplicates: true })
      if (insertErr) {
        console.error('[ai-email] AI reply sent but failed to record locally:', insertErr.message)
      } else {
        await serviceClient.from('email_threads').update({ last_message_at: insertRow.sent_at }).eq('id', threadId)
      }
    } else {
      const { error: insertErr } = await serviceClient.from('email_messages').insert({
        tenant_id: mailbox.tenant_id,
        thread_id: threadId,
        mailbox_id: mailbox.id,
        direction: 'outbound',
        from_address: mailboxAddress,
        to_addresses: [toAddress],
        body_text: bodyText,
        sent_at: null,
        source_message_id: null,
        authored_by: 'ai_draft_pending',
        requires_approval: true,
        ai_metadata: aiMetadata,
      })
      if (insertErr) {
        console.error('[ai-email] Failed to record AI draft:', insertErr.message)
      }
    }
  } catch (err) {
    console.error('[ai-email] maybeDraftAiReply failed:', err)
  }
}
