import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { emitEvent } from '@/utils/supabase/event-bus'
import {
  assignLabel,
  createLabelSuggestion,
  deleteLabelSuggestion,
  getLabelAssignmentsForThread,
} from '@/modules/email-labels/server/repository'
import { resolveLabelAutoApply } from './gate'

type AiQuotingMode = Database['public']['Enums']['ai_quoting_mode']

// Called from orchestrate.ts right after the existing classify() call, with
// its suggestedLabelIds passed straight through — no second Gemini call.
// Never throws — mirrors maybeDraftAiReply's own best-effort standard, since
// a labeling failure must never affect the (already-persisted) inbound
// message or the draft-reply flow running alongside it.
export async function maybeSuggestLabels(
  serviceClient: SupabaseClient<Database>,
  tenantId: string,
  threadId: string,
  mode: Exclude<AiQuotingMode, 'off'>,
  suggestedLabelIds: string[],
  model: string
): Promise<void> {
  if (suggestedLabelIds.length === 0) return

  try {
    const { data: existingAssignments } = await getLabelAssignmentsForThread(serviceClient, tenantId, threadId)
    const alreadyApplied = new Set((existingAssignments ?? []).map((a) => a.label_id))

    const autoApply = resolveLabelAutoApply(mode)

    for (const labelId of suggestedLabelIds) {
      if (alreadyApplied.has(labelId)) continue

      if (autoApply) {
        const { error } = await assignLabel(serviceClient, tenantId, threadId, labelId, null)
        if (error) {
          console.error('[ai-email] Failed to auto-apply suggested label:', error)
          continue
        }
        // A suggestion made before the tenant graduated to auto_send could
        // otherwise sit stale in the review queue for a label the thread
        // now already has.
        await deleteLabelSuggestion(serviceClient, tenantId, threadId, labelId)
        await emitEvent(serviceClient, 'email.label_added', 'ai-email', { thread_id: threadId, label_id: labelId }, tenantId)
      } else {
        // ON CONFLICT DO NOTHING at the DB level (unique constraint on
        // thread_id+label_id) dedupes re-suggestion on later messages.
        const { error } = await createLabelSuggestion(serviceClient, tenantId, threadId, labelId, model)
        if (error && error.code !== '23505') {
          console.error('[ai-email] Failed to create label suggestion:', error)
        }
      }
    }
  } catch (err) {
    console.error('[ai-email] maybeSuggestLabels failed:', err)
  }
}
