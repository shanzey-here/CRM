'use client'

import { useEffect, useState, useRef, useTransition } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  AnnouncementRecord,
  isAnnouncementActive,
  matchesAnnouncementTarget,
  sortAnnouncements,
} from '@/modules/announcements/matching'
import { dismissAnnouncementAction } from '../announcements/actions'

const SEVERITY_STYLES: Record<AnnouncementRecord['severity'], string> = {
  info: 'bg-blue-50 border border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border border-amber-200 text-amber-800',
  critical: 'bg-white border-2 border-red-600 text-red-700',
}

interface Props {
  initial: AnnouncementRecord[]
  tenantId: string
  planId: string | null
  userId: string
}

export function AnnouncementBannerStack({ initial, tenantId, planId, userId }: Props) {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>(initial)
  const [isPending, startTransition] = useTransition()
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const matches = (a: AnnouncementRecord) =>
    isAnnouncementActive(a) && matchesAnnouncementTarget(a, { tenantId, planId })

  // Live expiry: schedule a removal for each banner's own ends_at, so it
  // disappears without waiting for a Realtime event or a reload.
  useEffect(() => {
    const timers = timersRef.current
    for (const a of announcements) {
      if (a.ends_at && !timers.has(a.id)) {
        const delay = new Date(a.ends_at).getTime() - Date.now()
        if (delay > 0) {
          const t = setTimeout(() => {
            setAnnouncements((prev) => prev.filter((x) => x.id !== a.id))
            timers.delete(a.id)
          }, delay)
          timers.set(a.id, t)
        }
      }
    }
    return () => {
      for (const t of timers.values()) clearTimeout(t)
      timers.clear()
    }
  }, [announcements])

  useEffect(() => {
    const supabase = createClient()
    let isMounted = true

    const channel = supabase.channel(`tenant-announcements-${tenantId}`)

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'platform_announcements' },
      (payload) => {
        const a = payload.new as AnnouncementRecord
        if (!matches(a)) return
        setAnnouncements((prev) => (prev.some((x) => x.id === a.id) ? prev : sortAnnouncements([...prev, a])))
      }
    )

    channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'platform_announcements' },
      (payload) => {
        const a = payload.new as AnnouncementRecord
        setAnnouncements((prev) => {
          const withoutIt = prev.filter((x) => x.id !== a.id)
          return matches(a) ? sortAnnouncements([...withoutIt, a]) : withoutIt
        })
      }
    )

    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'platform_announcements' },
      (payload) => {
        const old = payload.old as { id: string }
        setAnnouncements((prev) => prev.filter((x) => x.id !== old.id))
      }
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }
      channel.subscribe()
    })

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, planId])

  function handleDismiss(id: string) {
    setDismissingId(id)
    startTransition(async () => {
      const result = await dismissAnnouncementAction(id)
      if (!result?.error) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id))
      }
      setDismissingId(null)
    })
  }

  if (announcements.length === 0) return null

  return (
    <div className="flex flex-col">
      {announcements.map((a) => (
        <div key={a.id} className={`px-4 py-3 text-sm font-medium flex items-center justify-between gap-4 ${SEVERITY_STYLES[a.severity]}`}>
          <div>
            <span className="font-semibold">{a.title}</span>
            <span className="ml-2">{a.body}</span>
          </div>
          {a.dismissible && (
            <button
              onClick={() => handleDismiss(a.id)}
              disabled={isPending && dismissingId === a.id}
              className="shrink-0 opacity-70 hover:opacity-100 transition-opacity disabled:opacity-30"
              title="Dismiss announcement"
              aria-label="Dismiss announcement"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
