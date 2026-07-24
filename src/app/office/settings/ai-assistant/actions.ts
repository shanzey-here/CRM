'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { aiQuotingModeSchema } from '@/modules/settings/ai-assistant/schemas'
import { updateAiQuotingMode } from '@/modules/settings/ai-assistant/server/repository'

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

  const { error } = await updateAiQuotingMode(supabase, tenantId, parsed.data)
  if (error) return { success: false, error: error.message }

  revalidatePath('/office/settings/ai-assistant')
  return { success: true }
}
