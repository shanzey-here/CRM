'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, X } from 'lucide-react'

export function RealtimeAlerts({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<{ id: string; message: string }[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: any = null

    console.log('[RealtimeAlerts] Setting up subscription for tenantId:', tenantId)

    // 1. Wait for session to be fully restored before subscribing to Realtime
    // This prevents the WebSocket from connecting with an anonymous token before the JWT is loaded!
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        console.warn('[RealtimeAlerts] No active session found, Realtime will likely fail RLS.')
        return
      }

      // Explicitly set the token just to be absolutely sure
      supabase.realtime.setAuth(session.access_token)
      console.log('[RealtimeAlerts] JWT set on Realtime connection')

      // 2. Subscribe to leads table specifically for this tenant
      // We append a random string to the channel name to avoid a known race condition in React Strict Mode
      // where `supabase.channel()` returns an already-subscribing instance before cleanup completes.
      channel = supabase
        .channel(`leads-inquiries-${tenantId}-${Math.random().toString(36).substring(7)}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'leads',
            filter: `tenant_id=eq.${tenantId}`
          },
          (payload) => {
            console.log('[RealtimeAlerts] **CALLBACK FIRED** - Received postgres_changes event:', payload)
            if (payload.new && payload.new.stage === 'inquiry') {
              const newAlert = {
                id: payload.new.id,
                message: 'New Inquiry Received!'
              }
              setAlerts((prev) => [...prev, newAlert])
              playDingSound()
              router.refresh() 

              setTimeout(() => {
                setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id))
              }, 5000)
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[RealtimeAlerts] Subscription status:', status)
          if (err) console.error('[RealtimeAlerts] Subscription error:', err)
        })
    })

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [tenantId, router])

  const playDingSound = () => {
    try {
      // Browser autoplay policies require user interaction before AudioContext can play.
      // If the user hasn't clicked anywhere, this will silently fail or warn in console, which is expected/graceful.
      if (!audioContextRef.current) {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
        if (AudioContext) {
          audioContextRef.current = new AudioContext()
        } else {
          return // Fallback for unsupported browsers
        }
      }

      const ctx = audioContextRef.current
      // Resume context if it was suspended due to autoplay policy
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime) // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5) // Slide down to A4

      gainNode.gain.setValueAtTime(0, ctx.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

      osc.connect(gainNode)
      gainNode.connect(ctx.destination)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch (err) {
      console.warn('Could not play audio alert:', err)
    }
  }

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  if (alerts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between p-4 bg-white border border-emerald-200 rounded-lg shadow-lg max-w-sm animate-in slide-in-from-bottom-5 fade-in duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
              <Bell size={20} className="animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{alert.message}</p>
              <p className="text-xs text-slate-500">Check your leads dashboard.</p>
            </div>
          </div>
          <button
            onClick={() => dismissAlert(alert.id)}
            className="ml-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
