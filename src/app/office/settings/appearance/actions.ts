'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { uiThemeSchema } from '@/modules/settings/theme/schemas'
import { updateTenantSettings } from '@/modules/settings/branding/server/repository'

export async function updateUiThemeAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    throw new Error('Unauthorized')
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    throw new Error('No tenant context')
  }

  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden')
  }

  const parsed = uiThemeSchema.safeParse(formData.get('ui_theme'))
  if (!parsed.success) {
    throw new Error(`Invalid theme: ${JSON.stringify(parsed.error.flatten())}`)
  }

  const { error } = await updateTenantSettings(supabase, tenantId, { ui_theme: parsed.data })
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  // Tenant-level setting, applied server-side on every /office request via
  // office/layout.tsx — a real page refresh after saving is the correct,
  // simplest way for the change to take effect, not a limitation to work
  // around with client-side theme state.
  revalidatePath('/office', 'layout')
}
