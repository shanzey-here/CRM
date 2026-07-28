import { Database } from '@/types/database.types'

type AiQuotingMode = Database['public']['Enums']['ai_quoting_mode']

export type DraftOutcome = {
  authoredBy: 'ai_sent' | 'ai_draft_pending'
  requiresApproval: boolean
  autoSend: boolean
}

// Implements the four-mode semantics exactly as documented in
// supabase/migrations/00044_phase2_email_db.sql's header comment. Mode
// 'off' is handled by the caller (maybeDraftAiReply) exiting before this is
// ever invoked — it's not a case in this function, so a bug here can never
// accidentally cause an 'off' tenant to draft anything.
//
// Note (ai-quoting-integration): this function used to also compute
// isKnownGap (auto_send + needsQuote => a limitation, since real quote
// generation didn't exist). That's no longer something mode+needsQuote
// alone can determine — whether the gap is actually closed depends on
// whether extraction+pricing succeeded, a fact only the caller knows after
// attempting it. orchestrate.ts now computes knownGap itself.
export function resolveDraftOutcome(mode: Exclude<AiQuotingMode, 'off'>, needsQuote: boolean): DraftOutcome {
  switch (mode) {
    case 'assist':
      // Auto-send only for routine, non-committal messages. Any reply
      // carrying a priced quote is always held for review, regardless of
      // how routine the rest of the conversation felt — the gate is on the
      // action (does this reply need pricing), not the conversation.
      return needsQuote
        ? { authoredBy: 'ai_draft_pending', requiresApproval: true, autoSend: false }
        : { authoredBy: 'ai_sent', requiresApproval: false, autoSend: true }

    case 'quote_review':
      // Every draft, routine or not, is held for approval — no auto-send
      // path in this mode at all.
      return { authoredBy: 'ai_draft_pending', requiresApproval: true, autoSend: false }

    case 'auto_send':
      // Everything sends automatically, including the quote-needing case —
      // whether that's now a real computed quote or a clarifying-question
      // fallback depends on extraction, decided by the caller.
      return { authoredBy: 'ai_sent', requiresApproval: false, autoSend: true }
  }
}
