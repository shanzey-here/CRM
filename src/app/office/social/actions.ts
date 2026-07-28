'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { composePostSchema } from '@/modules/social/schemas'
import { publishNow, cancelScheduledPost } from '@/modules/social/server/scheduler'
import type { PublishBatchResult } from '@/modules/social/server/publish'

type OfficeStaffGuard =
  | { error: 'Unauthorized' | 'No tenant context' | 'Forbidden' }
  | { supabase: Awaited<ReturnType<typeof createClient>>; tenantId: string }

async function requireOfficeStaff(): Promise<OfficeStaffGuard> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' }

  // tenant_admin AND dispatcher — matches the existing /office layout
  // guard exactly, same access level as email (operational tooling, not
  // Settings-level).
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    return { error: 'Forbidden' }
  }

  return { supabase, tenantId }
}

export type ComposePostResult =
  | { success: true; mode: 'now'; results: PublishBatchResult[] }
  | { success: true; mode: 'later'; scheduledFor: string }
  | { success: false; error: string }

export async function composePostAction(formData: FormData): Promise<ComposePostResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const parsed = composePostSchema.safeParse({
    content: formData.get('content'),
    accountIds: formData.getAll('accountIds'),
    scheduleMode: formData.get('scheduleMode'),
    scheduledFor: formData.get('scheduledFor') || undefined,
  })

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { content, accountIds, scheduleMode, scheduledFor } = parsed.data
  const scheduledForIso = scheduleMode === 'now' ? new Date().toISOString() : scheduledFor!

  const { data: inserted, error: insertErr } = await supabase
    .from('scheduled_posts')
    .insert({ tenant_id: tenantId, content, account_ids: accountIds, scheduled_for: scheduledForIso })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return { success: false, error: insertErr?.message ?? 'Failed to save post' }
  }

  revalidatePath('/office/social')

  if (scheduleMode === 'later') {
    return { success: true, mode: 'later', scheduledFor: scheduledForIso }
  }

  // "Post now" — publish synchronously in the same request, through the
  // same atomic claim + publishToAccounts() path the cron sweep uses.
  const results = await publishNow(supabase, tenantId, inserted.id)
  revalidatePath('/office/social')

  if (!results) {
    return { success: false, error: 'Post could not be claimed for publishing (already processed)' }
  }

  return { success: true, mode: 'now', results }
}

export type CancelPostResult = { success: true } | { success: false; error: string }

export async function cancelScheduledPostAction(postId: string): Promise<CancelPostResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const { data, error } = await cancelScheduledPost(supabase, tenantId, postId)
  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'This post has already been published, cancelled, or is currently being sent' }

  revalidatePath('/office/social')
  return { success: true }
}
