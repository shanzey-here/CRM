import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { AnnouncementFormInput } from '../schemas'
import { AnnouncementRecord, isAnnouncementActive, matchesAnnouncementTarget, sortAnnouncements } from '../matching'

type Client = SupabaseClient<Database>

export async function listAnnouncementsForSuperAdmin(supabase: Client) {
  const { data, error } = await supabase
    .from('platform_announcements')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch announcements: ${error.message}`)
  return data
}

export async function createAnnouncement(
  supabase: Client,
  createdBy: string,
  input: AnnouncementFormInput
) {
  const { data, error } = await supabase
    .from('platform_announcements')
    .insert({
      title: input.title,
      body: input.body,
      severity: input.severity,
      target_type: input.target_type,
      target_ids: input.target_type === 'all_tenants' ? [] : input.target_ids,
      dismissible: input.dismissible,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create announcement: ${error.message}`)
  return data
}

export async function updateAnnouncement(
  supabase: Client,
  id: string,
  input: AnnouncementFormInput
) {
  const { data, error } = await supabase
    .from('platform_announcements')
    .update({
      title: input.title,
      body: input.body,
      severity: input.severity,
      target_type: input.target_type,
      target_ids: input.target_type === 'all_tenants' ? [] : input.target_ids,
      dismissible: input.dismissible,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to update announcement: ${error.message}`)
  return data
}

export async function closeAnnouncementNow(supabase: Client, id: string) {
  const { data, error } = await supabase
    .from('platform_announcements')
    .update({ ends_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to close announcement: ${error.message}`)
  return data
}

export async function deleteAnnouncement(supabase: Client, id: string) {
  const { error } = await supabase.from('platform_announcements').delete().eq('id', id)
  if (error) throw new Error(`Failed to delete announcement: ${error.message}`)
}

// Explicit app-level targeting/role filtering — the RLS SELECT policy already
// restricts rows to super_admin/tenant_admin callers, this further narrows to
// the announcements that actually apply to *this* tenant + aren't dismissed.
export async function getActiveAnnouncementsForTenant(
  supabase: Client,
  { tenantId, planId, userId }: { tenantId: string; planId: string | null; userId: string }
): Promise<AnnouncementRecord[]> {
  const nowIso = new Date().toISOString()

  const { data: candidates, error } = await supabase
    .from('platform_announcements')
    .select('*')
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)

  if (error) throw new Error(`Failed to fetch announcements: ${error.message}`)
  if (!candidates || candidates.length === 0) return []

  const { data: dismissals, error: dismissalError } = await supabase
    .from('tenant_announcement_dismissals')
    .select('announcement_id')
    .eq('user_id', userId)

  if (dismissalError) throw new Error(`Failed to fetch dismissals: ${dismissalError.message}`)
  const dismissedIds = new Set((dismissals ?? []).map((d) => d.announcement_id))

  const visible = candidates.filter(
    (a) =>
      isAnnouncementActive(a, new Date()) &&
      matchesAnnouncementTarget(a, { tenantId, planId }) &&
      !dismissedIds.has(a.id)
  )

  return sortAnnouncements(visible)
}

export async function dismissAnnouncement(
  supabase: Client,
  { announcementId, tenantId, userId }: { announcementId: string; tenantId: string; userId: string }
) {
  const { error } = await supabase
    .from('tenant_announcement_dismissals')
    .insert({ announcement_id: announcementId, tenant_id: tenantId, user_id: userId })

  if (error) throw new Error(`Failed to dismiss announcement: ${error.message}`)
}
