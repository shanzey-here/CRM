'use server'

import { createClient } from '@/lib/supabase/server'
import { dismissAnnouncement } from '@/modules/announcements/server/repository'

export async function dismissAnnouncementAction(announcementId: string) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    return { error: 'No tenant context' }
  }

  // App-level check, same idiom as branding/actions.ts. RLS (role +
  // dismissible = true) is the real, unbypassable enforcement — this is a
  // defense-in-depth check that also gives a clean error for the UI.
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Forbidden' }
  }

  try {
    await dismissAnnouncement(supabase, { announcementId, tenantId, userId: user.id })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to dismiss announcement' }
  }

  return { success: true }
}
