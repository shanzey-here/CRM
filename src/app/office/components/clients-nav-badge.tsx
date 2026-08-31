'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  getUnreadNewLeadCountAction,
  markNotificationsReadAction,
} from '@/modules/notifications/server/actions'

/**
 * Live count of this user's UNREAD `new_lead` notifications, shown on the
 * Clients sidebar item. Not a new counting system:
 *
 *  - Data source: the same `notifications` rows the bell reads, same
 *    `target_user_id = auth.uid()` RLS, same "unread = read_at IS NULL".
 *    `getUnreadNewLeadCountAction()` is just a COUNT of those rows filtered to
 *    `notification_type = 'new_lead'`.
 *  - "Seen": the same per-user `read_at` the bell uses. Opening the Clients
 *    module (any /office/clients* route) marks all unread `new_lead`
 *    notifications read — for this user only — via markNotificationsReadAction,
 *    which also drives the bell's own state (both read the same rows; the bell
 *    reflects it on its next fetch).
 *  - Realtime: the same shared browser Supabase client as the bell — one
 *    WebSocket. A distinct channel name (like announcement-banner-stack.tsx)
 *    only so its subscribe/teardown can't disturb the bell's channel; it
 *    listens to the exact same `notifications` INSERTs for this user.
 *  - Every realtime event just re-runs the COUNT query, so multiple arrivals
 *    accumulate automatically and the number can never drift from the DB.
 */
export function ClientsNavBadge({ userId }: { userId: string }) {
  const pathname = usePathname()
  const [count, setCount] = useState(0)
  const onClientsRef = useRef(false)

  const refresh = async () => {
    const res = await getUnreadNewLeadCountAction()
    if (res.success) setCount(res.count ?? 0)
  }

  // Initial fetch + realtime.
  useEffect(() => {
    let active = true
    refresh()

    const supabase = createClient()
    const channel = supabase.channel(`office-clients-badge-${userId}`)

    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `target_user_id=eq.${userId}`,
      },
      (payload) => {
        if (!active) return
        if ((payload.new as { notification_type?: string })?.notification_type !== 'new_lead') return
        // Already sitting in the Clients module → keep it "seen".
        if (onClientsRef.current) {
          markNotificationsReadAction(undefined, { type: 'new_lead' }).then(() => {
            if (active) setCount(0)
          })
          return
        }
        refresh()
      },
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      channel.subscribe()
    })

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Opening the Clients module marks all unread `new_lead` notifications read
  // for this user (default per the spec: "opening the module counts as seeing
  // what's new"). Idempotent — a no-op when nothing is unread.
  useEffect(() => {
    const onClients = pathname === '/office/clients' || pathname.startsWith('/office/clients/')
    onClientsRef.current = onClients
    if (onClients) {
      setCount(0)
      markNotificationsReadAction(undefined, { type: 'new_lead' })
    }
  }, [pathname])

  if (count <= 0) return null

  return (
    <span
      aria-label={`${count} new ${count === 1 ? 'inquiry' : 'inquiries'}`}
      className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
