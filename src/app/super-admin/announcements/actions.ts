'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import { announcementFormSchema } from '@/modules/announcements/schemas'
import {
  createAnnouncement,
  updateAnnouncement,
  closeAnnouncementNow,
  deleteAnnouncement,
} from '@/modules/announcements/server/repository'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }
  return user
}

function parseAnnouncementFormData(formData: FormData) {
  return announcementFormSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
    severity: formData.get('severity'),
    target_type: formData.get('target_type'),
    target_ids: formData.getAll('target_ids'),
    dismissible: formData.get('dismissible') === 'true',
    starts_at: formData.get('starts_at') || null,
    ends_at: formData.get('ends_at') || null,
  })
}

export async function createAnnouncementAction(formData: FormData) {
  const user = await requireSuperAdmin()

  const parsed = parseAnnouncementFormData(formData)
  if (!parsed.success) {
    return { error: `Invalid input: ${JSON.stringify(parsed.error.flatten())}` }
  }

  const serviceClient = createServiceRoleClient()
  await createAnnouncement(serviceClient, user.id, parsed.data)

  revalidatePath('/super-admin/announcements')
  return { success: true }
}

export async function updateAnnouncementAction(id: string, formData: FormData) {
  await requireSuperAdmin()

  const parsed = parseAnnouncementFormData(formData)
  if (!parsed.success) {
    return { error: `Invalid input: ${JSON.stringify(parsed.error.flatten())}` }
  }

  const serviceClient = createServiceRoleClient()
  await updateAnnouncement(serviceClient, id, parsed.data)

  revalidatePath('/super-admin/announcements')
  return { success: true }
}

export async function closeAnnouncementNowAction(id: string) {
  await requireSuperAdmin()

  const serviceClient = createServiceRoleClient()
  await closeAnnouncementNow(serviceClient, id)

  revalidatePath('/super-admin/announcements')
  return { success: true }
}

export async function deleteAnnouncementAction(id: string) {
  await requireSuperAdmin()

  const serviceClient = createServiceRoleClient()
  await deleteAnnouncement(serviceClient, id)

  revalidatePath('/super-admin/announcements')
  return { success: true }
}
