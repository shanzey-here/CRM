import { Database } from '@/types/database.types'

type AiQuotingMode = Database['public']['Enums']['ai_quoting_mode']

export type DraftOutcome = {
  authoredBy: 'ai_sent' | 'ai_draft_pending'
  requiresApproval: boolean
  autoSend: boolean
  isKnownGap: boolean
}

// Implements the four-mode semantics exactly as documented in
// supabase/migrations/00044_phase2_email_db.sql's header comment. Mode
// 'off' is handled by the caller (maybeDraftAiReply) exiting before this is
// ever invoked — it's not a case in this function, so a bug here can never
// accidentally cause an 'off' tenant to draft anything.
export function resolveDraftOutcome(mode: Exclude<AiQuotingMode, 'off'>, needsQuote: boolean): DraftOutcome {
  switch (mode) {
    case 'assist':
      // Auto-send only for routine, non-committal messages. Any reply
      // carrying a priced quote is always held for review, regardless of
      // how routine the rest of the conversation felt — the gate is on the
      // action (does this reply need pricing), not the conversation.
      return needsQuote
        ? { authoredBy: 'ai_draft_pending', requiresApproval: true, autoSend: false, isKnownGap: false }
        : { authoredBy: 'ai_sent', requiresApproval: false, autoSend: true, isKnownGap: false }

    case 'quote_review':
      // Every draft, routine or not, is held for approval — no auto-send
      // path in this mode at all.
      return { authoredBy: 'ai_draft_pending', requiresApproval: true, autoSend: false, isKnownGap: false }

    case 'auto_send':
      // Everything sends automatically, including the quote-needing case —
      // real quote generation doesn't exist yet (that's
      // ai-quoting-integration's job), so a tenant on auto_send today gets
      // an automated holding reply instead of an actual auto-sent quote.
      // isKnownGap makes this limitation visible in ai_metadata rather than
      // silently indistinguishable from a normal auto-sent reply.
      return { authoredBy: 'ai_sent', requiresApproval: false, autoSend: true, isKnownGap: needsQuote }
  }
}
