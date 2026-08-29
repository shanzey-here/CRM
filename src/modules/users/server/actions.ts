'use server'

import { createClient } from '@/lib/supabase/server'
import { getTenantStaff, TenantUser } from './repository'

export async function getTenantStaffAction(): Promise<{ success: boolean; data?: TenantUser[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { success: false, error: 'No tenant context' }
  }

  const { data, error } = await getTenantStaff(supabase, tenantId)
  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, data: data || [] }
}
