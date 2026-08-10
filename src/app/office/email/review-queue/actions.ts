'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { assignLabel, deleteLabelSuggestion } from '@/modules/email-labels/server/repository'
import { emitEvent } from '@/utils/supabase/event-bus'

async function requireOfficeStaff() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' as const }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' as const }
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    return { error: 'Forbidden' as const }
  }

  return { supabase, tenantId, userId: user.id }
}

export async function approveLabelSuggestionAction(
  suggestionId: string,
  threadId: string,
  labelId: string
): Promise<{ success: boolean; error?: string }> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId, userId } = guard

  const { error: assignError } = await assignLabel(supabase, tenantId, threadId, labelId, userId)
  if (assignError) return { success: false, error: assignError.message }

  await deleteLabelSuggestion(supabase, tenantId, threadId, labelId)
  // No tenantId override here: this runs with a regular authenticated
  // client (not service_role), and emit_domain_event() rejects the
  // p_tenant_id override for any caller other than service_role — it
  // resolves current_tenant_id() from the request's own JWT instead, which
  // is already correct for a real user session.
  const { error: eventError } = await emitEvent(supabase, 'email.label_added', 'ai-email', { thread_id: threadId, label_id: labelId })
  if (eventError) console.error('[review-queue] Failed to emit email.label_added event:', eventError.message)

  revalidatePath('/office/email/review-queue')
  revalidatePath(`/office/email/${threadId}`)
  return { success: true }
}

export async function rejectLabelSuggestionAction(
  suggestionId: string,
  threadId: string,
  labelId: string
): Promise<{ success: boolean; error?: string }> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const { error } = await deleteLabelSuggestion(supabase, tenantId, threadId, labelId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/office/email/review-queue')
  return { success: true }
}
