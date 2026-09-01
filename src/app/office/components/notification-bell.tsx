'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, Check, X } from 'lucide-react'
import { getUserNotificationsAction, markNotificationsReadAction } from '@/modules/notifications/server/actions'

export type NotificationRecord = {
  id: string
  notification_type: 'new_lead' | 'quote_accepted' | 'task_assigned' | 'trial_expiring_soon'
  title: string
  message: string
  action_url: string | null
  read_at: string | null
  created_at: string
}

export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [toastAlerts, setToastAlerts] = useState<{ id: string; title: string; message: string }[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Initialize audio context on first user interaction to bypass autoplay policies
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContext) {
          audioContextRef.current = new AudioContext()
        }
      }
      
      const ctx = audioContextRef.current
      if (ctx && ctx.state === 'suspended') {
        ctx.resume()
      }
    }

    window.addEventListener('click', initAudio, { once: true })
    window.addEventListener('keydown', initAudio, { once: true })
    window.addEventListener('touchstart', initAudio, { once: true })

    return () => {
      window.removeEventListener('click', initAudio)
      window.removeEventListener('keydown', initAudio)
      window.removeEventListener('touchstart', initAudio)
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    async function fetchInitial() {
      const res = await getUserNotificationsAction()
      if (res.success && res.data) {
        setNotifications(res.data as NotificationRecord[])
      }
    }
    fetchInitial()
  }, [])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    let isMounted = true

    console.log('[NotificationBell] Setting up subscription for target_user_id:', userId)

    const channel = supabase.channel(`user-notifications-${userId}`)
    
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `target_user_id=eq.${userId}`
      },
      (payload) => {
        const newNotif = payload.new as NotificationRecord
        setNotifications((prev) => [newNotif, ...prev])

        // The real gap: notifications-ui only preserved the legacy sound/toast for 'new_lead'.
        // We now extend this live alerting behavior to all real-time notification types (quote_accepted, task_assigned, etc).
        const newAlert = {
          id: newNotif.id,
          title: newNotif.title || 'New Notification',
          message: newNotif.message || 'Check your notifications.'
        }
        setToastAlerts((prev) => [...prev, newAlert])
        playDingSound()
        
        setTimeout(() => {
          setToastAlerts((prev) => prev.filter((a) => a.id !== newAlert.id))
        }, 5000)
      }
    )

    // Ensure session is loaded and token is set before connecting WebSocket
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
  }, [userId])

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const playDingSound = () => {
    try {
      const ctx = audioContextRef.current
      if (!ctx) return

      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const t = ctx.currentTime

      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.value = 1318.51 // E6 note
      gain1.gain.setValueAtTime(0, t)
      gain1.gain.linearRampToValueAtTime(0.15, t + 0.02)
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(t)
      osc1.stop(t + 0.15)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.value = 1046.50 // C6 note
      gain2.gain.setValueAtTime(0, t + 0.1)
      gain2.gain.linearRampToValueAtTime(0.15, t + 0.12)
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(t + 0.1)
      osc2.stop(t + 0.4)
    } catch (err) {
      console.warn('Could not play audio alert:', err)
    }
  }

  const dismissToast = (id: string) => {
    setToastAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return

    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    await markNotificationsReadAction()
  }

  const handleNotificationClick = async (notif: NotificationRecord) => {
    setIsOpen(false)
    if (!notif.read_at) {
      // Optimistic update
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read_at: new Date().toISOString() } : n))
      await markNotificationsReadAction([notif.id])
    }
    
    if (notif.action_url) {
      router.push(notif.action_url)
    }
  }

  const unreadCount = notifications.filter(n => !n.read_at).length

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-full"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-semibold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                >
                  <Check size={14} />
                  Mark all read
                </button>
              )}
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No notifications yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {notifications.map((notif) => (
                    <li key={notif.id}>
                      <button
                        onClick={() => handleNotificationClick(notif)}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex flex-col gap-1 ${!notif.read_at ? 'bg-emerald-50/50' : ''}`}
                      >
                        <div className="flex justify-between items-start w-full">
                          <p className={`text-sm ${!notif.read_at ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {notif.title}
                          </p>
                          {!notif.read_at && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(notif.created_at).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                          })}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live Toast Alerts */}
      {toastAlerts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toastAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-4 bg-white border border-emerald-200 rounded-lg shadow-lg max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                  <Bell size={20} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{alert.title}</p>
                  <p className="text-xs text-slate-500">{alert.message}</p>
                </div>
              </div>
              <button
                onClick={() => dismissToast(alert.id)}
                className="ml-4 text-slate-400 hover:text-slate-600 transition-colors"
                title="Dismiss notification"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
