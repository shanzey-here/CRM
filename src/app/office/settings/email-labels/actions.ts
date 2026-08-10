'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { emailLabelSchema } from '@/modules/email-labels/schemas'
import { createLabel, updateLabel, deleteLabel, findLabelByColor, getLabelUsageCount } from '@/modules/email-labels/server/repository'

async function requireTenantAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'Unauthorized' as const }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' as const }
  if (tenantRole !== 'tenant_admin') return { error: 'Forbidden: tenant_admin only' as const }

  return { supabase, tenantId }
}

function parseLabelFormData(formData: FormData) {
  return emailLabelSchema.safeParse({
    name: formData.get('name'),
    color_hex: formData.get('color_hex'),
  })
}

export async function createLabelAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const parsed = parseLabelFormData(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { error } = await createLabel(supabase, tenantId, parsed.data)
  if (error) {
    if (error.code === '23505') {
      const { data: conflicting } = await findLabelByColor(supabase, tenantId, parsed.data.color_hex)
      return {
        success: false,
        error: conflicting
          ? `This color is already used by ${conflicting.name} — pick a different one`
          : 'A label with this name already exists',
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/office/settings/email-labels')
  return { success: true }
}

export async function updateLabelAction(labelId: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const parsed = parseLabelFormData(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { error } = await updateLabel(supabase, tenantId, labelId, parsed.data)
  if (error) {
    if (error.code === '23505') {
      const { data: conflicting } = await findLabelByColor(supabase, tenantId, parsed.data.color_hex)
      return {
        success: false,
        error: conflicting
          ? `This color is already used by ${conflicting.name} — pick a different one`
          : 'A label with this name already exists',
      }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/office/settings/email-labels')
  return { success: true }
}

export async function getLabelUsageCountAction(labelId: string): Promise<{ count: number; error?: string }> {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return { count: 0, error: guard.error }
  const { supabase, tenantId } = guard

  const { count, error } = await getLabelUsageCount(supabase, tenantId, labelId)
  return { count, error: error?.message }
}

// Server-side is_default re-check — the real, unbypassable backstop is the
// prevent_default_label_delete DB trigger, but this gives a clean error
// message instead of a raw Postgres exception for the normal UI path.
export async function deleteLabelAction(labelId: string): Promise<{ success: boolean; error?: string }> {
  const guard = await requireTenantAdmin()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const { error } = await deleteLabel(supabase, tenantId, labelId)
  if (error) return { success: false, error: error.message.includes('default email label') ? 'Default labels cannot be deleted.' : error.message }

  revalidatePath('/office/settings/email-labels')
  return { success: true }
}
