'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { aiQuotingModeSchema } from '@/modules/settings/ai-assistant/schemas'
import { updateAiQuotingMode, getAiAssistantSettings, getGraduationStatus } from '@/modules/settings/ai-assistant/server/repository'

export async function updateAiQuotingModeAction(rawMode: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { success: false, error: 'No tenant context' }

  // Re-checked here too, not just in the layout guard — defense in depth,
  // matching every other module's convention in this project.
  if (tenantRole !== 'tenant_admin') return { success: false, error: 'Forbidden' }

  const parsed = aiQuotingModeSchema.safeParse(rawMode)
  if (!parsed.success) return { success: false, error: 'Invalid mode' }

  // Server-side re-check of the graduation gate — the disabled radio in
  // ModeSelector is a UX convenience, not the enforcement. Only gate the
  // moment of switching TO auto_send; a tenant already on it isn't
  // continuously re-evaluated (no anomaly detection in v1, by design).
  if (parsed.data === 'auto_send') {
    const { data: current } = await getAiAssistantSettings(supabase, tenantId)
    if (current?.ai_quoting_mode !== 'auto_send') {
      const status = await getGraduationStatus(supabase, tenantId)
      if (!status.qualifies) {
        return { success: false, error: `auto_send is not yet available for this tenant (${status.unedited}/${status.total} unedited approvals in the last ${status.total < 20 ? status.total : 20}; needs 20 resolved drafts at 90% unedited or higher).` }
      }
    }
  }

  const { error } = await updateAiQuotingMode(supabase, tenantId, parsed.data)
  if (error) return { success: false, error: error.message }

  revalidatePath('/office/settings/ai-assistant')
  return { success: true }
}
