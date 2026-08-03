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

export async function markNotificationsReadAction(ids?: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() })

  if (ids && ids.length > 0) {
    query = query.in('id', ids).eq('target_user_id', user.id)
  } else {
    // Mark all as read
    query = query.eq('target_user_id', user.id).is('read_at', null)
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
