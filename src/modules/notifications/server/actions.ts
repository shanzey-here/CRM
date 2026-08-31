'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getUserNotificationsAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('target_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    console.error('[Notifications] Failed to fetch notifications:', error)
    return { success: false, error: 'Failed to fetch notifications' }
  }

  return { success: true, data }
}

// Live count of this user's UNREAD `new_lead` notifications — the exact same
// rows / RLS / "unread = read_at IS NULL" semantics the bell uses, just a
// COUNT filtered to one type. Backs the Clients nav badge; it and the bell can
// never disagree because they read the same rows.
export async function getUnreadNewLeadCountAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized', count: 0 }
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('target_user_id', user.id)
    .eq('notification_type', 'new_lead')
    .is('read_at', null)

  if (error) {
    console.error('[Notifications] Failed to count unread new_lead notifications:', error)
    return { success: false, error: 'Failed to count notifications', count: 0 }
  }

  return { success: true, count: count ?? 0 }
}

type NotificationType = 'new_lead' | 'quote_accepted' | 'task_assigned' | 'trial_expiring_soon'

export async function markNotificationsReadAction(
  ids?: string[],
  opts?: { type?: NotificationType },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() })

  if (ids && ids.length > 0) {
    query = query.in('id', ids).eq('target_user_id', user.id)
  } else {
    // Mark all this user's unread notifications read — optionally narrowed to
    // one type (the Clients nav badge passes `new_lead` on visiting /office/clients).
    query = query.eq('target_user_id', user.id).is('read_at', null)
    if (opts?.type) {
      query = query.eq('notification_type', opts.type)
    }
  }

  const { error } = await query

  if (error) {
    console.error('[Notifications] Failed to mark notifications as read:', error)
    return { success: false, error: 'Failed to mark as read' }
  }

  // No need to revalidate path aggressively since Realtime or optimistic UI handles client state,
  // but just in case for SSR pages:
  revalidatePath('/office', 'layout')

  return { success: true }
}
