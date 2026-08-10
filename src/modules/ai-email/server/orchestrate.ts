import { SupabaseClient } from '@supabase/supabase-js'
import { Database, Json } from '@/types/database.types'
import { buildOutboundMessage, sendMessage } from '@/modules/mailboxes/server/send'
import { getActiveInventoryItems } from '@/modules/inventory/server/repository'
import { getLlmAdapter } from '../provider'
import { buildSystemPrompt } from './persona'
import { getToneSamples } from './tone'
import { generateDraftReply, buildHoldingReply, buildClarifyingReply } from './draft'
import { resolveDraftOutcome } from './gate'
import { extractQuoteDetails, isExtractionComplete, missingFieldLabels, CatalogEntry } from './extract'
import { createQuoteFromExtraction } from './quote-creation'
import { maybeSuggestLabels } from './label-suggest'
import { getDefaultLabels } from '@/modules/email-labels/server/repository'

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

    const { data: defaultLabels } = await getDefaultLabels(serviceClient, mailbox.tenant_id)

    let needsQuote: boolean
    let classifyModel: string
    let suggestedLabelIds: string[] = []
    try {
      const classifyResult = await adapter.classify({ systemPrompt, threadText, defaultLabels: defaultLabels ?? [] })
      needsQuote = classifyResult.needsQuote
      classifyModel = classifyResult.model
      suggestedLabelIds = classifyResult.suggestedLabelIds
    } catch (err) {
      // Fail-safe: an unreadable/errored classification always defaults to
      // "needs review," never to an under-classified auto-send.
      console.error('[ai-email] classify() failed, defaulting to needsQuote=true:', err)
      needsQuote = true
      classifyModel = 'unknown'
    }

    // Labels are orthogonal to the draft/quote flow below — suggest/apply
    // them regardless of needsQuote, same classify() call either way.
    await maybeSuggestLabels(serviceClient, mailbox.tenant_id, threadId, mode, suggestedLabelIds, classifyModel)

    const companyName = tenantSettings?.company_legal_name || mailboxAddress
    let bodyText: string
    let draftModel: string | null = null
    let extractionModel: string | null = null
    let quoteComputed = false
    let quoteId: string | null = null
    let computedPrice: number | null = null

    if (needsQuote) {
      // Structured extraction — a distinct step from classification, never
      // extending it. Gated on the tenant's real catalog so the model can
      // only ever select a real inventory_item_id, never invent one.
      const { data: catalogRows } = await getActiveInventoryItems(serviceClient, mailbox.tenant_id)
      const catalog: CatalogEntry[] = (catalogRows ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        room: c.room,
        default_volume: c.default_volume,
      }))

      let extraction
      try {
        extraction = await extractQuoteDetails(adapter, { systemPrompt, threadText, catalog })
        extractionModel = extraction.model
      } catch (err) {
        console.error('[ai-email] extract() failed, falling back to clarifying reply:', err)
        extraction = null
      }

      if (extraction && isExtractionComplete(extraction)) {
        const creationResult = await createQuoteFromExtraction(serviceClient, {
          tenantId: mailbox.tenant_id,
          threadId,
          senderEmail: toAddress,
          senderName: recipientName,
          extraction,
          catalog,
        })

        if (creationResult.success) {
          quoteComputed = true
          quoteId = creationResult.quoteId
          computedPrice = creationResult.computedPrice

          // The number is deterministic (from the pricing engine above);
          // the model's only job here is prose around a given fact, same
          // "factual constraint, never invent" principle as the persona.
          const priceSystemPrompt = `${systemPrompt}\n\nYou now have a real computed price for this move: £${computedPrice.toFixed(2)}. State this exact figure clearly and confidently in your reply as the quote. Do not alter it, round it differently, or present it as an estimate range — it is a final figure.`
          const draftResult = await generateDraftReply(adapter, { systemPrompt: priceSystemPrompt, threadText, toneSamples })
          bodyText = draftResult.bodyText
          draftModel = draftResult.model
        } else {
          // Extraction was complete but quote creation itself failed
          // (e.g. geocoding/DB error) — this isn't the customer's fault, so
          // a clarifying question would be misleading. Fall back to the
          // original holding-reply wording instead.
          console.error('[ai-email] createQuoteFromExtraction failed:', creationResult.error)
          bodyText = buildHoldingReply({ companyName, recipientName })
        }
      } else {
        // Incomplete extraction — the expected common case for a first
        // inquiry. Ask, don't guess: name exactly what's missing.
        const missing = extraction ? missingFieldLabels(extraction) : []
        bodyText = buildClarifyingReply({ companyName, recipientName, missingFields: missing })
      }
    } else {
      const draftResult = await generateDraftReply(adapter, { systemPrompt, threadText, toneSamples })
      bodyText = draftResult.bodyText
      draftModel = draftResult.model
    }

    const outcome = resolveDraftOutcome(mode, needsQuote)

    // knownGap: true only when auto_send would auto-send a reply for a
    // quote-needing message where a real quote was NOT actually produced —
    // the one case where the auto-sent reply is still a clarifying
    // question/holding reply rather than a real price. False whenever
    // extraction succeeded and a real price went out, and false everywhere
    // it was already false before (off/assist-routine/quote_review).
    const knownGap = mode === 'auto_send' && needsQuote && !quoteComputed

    const aiMetadata: Json = {
      model: draftModel ?? classifyModel,
      promptVersion: PROMPT_VERSION,
      needsQuote,
      holdingReply: needsQuote && !quoteComputed,
      knownGap,
      ...(extractionModel ? { extractionModel } : {}),
      ...(quoteComputed ? { quoteComputed: true, quoteId, computedPrice } : {}),
      // Precise, mode-agnostic marker for "this went out with zero human
      // review" — assist mode's routine-reply path uses this exact same
      // outcome.autoSend branch, so this is not the same as "tenant is on
      // auto_send mode." Drives the auto-sent-log page's filter.
      ...(outcome.autoSend ? { autoSent: true } : {}),
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
