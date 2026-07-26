'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Bell, X } from 'lucide-react'

export function RealtimeAlerts({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<{ id: string; message: string }[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)

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

    // Attach to common interaction events
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

  useEffect(() => {
    const supabase = createClient()
    let channel: any = null
    
    console.log('[RealtimeAlerts] Setting up subscription for tenantId:', tenantId)

    // Ensure session is loaded and token is set before connecting WebSocket
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      channel = supabase
        .channel(`leads-inquiries-${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'leads',
            filter: `tenant_id=eq.${tenantId}`
          },
          (payload) => {
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
        .subscribe()
    })

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [tenantId, router])

  const playDingSound = () => {
    try {
      const ctx = audioContextRef.current
      if (!ctx) return

      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const t = ctx.currentTime

      // A softer, more professional "pop-ding" double-chime (WhatsApp/iOS style)
      // First note (Higher)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.value = 1318.51 // E6 note
      gain1.gain.setValueAtTime(0, t)
      gain1.gain.linearRampToValueAtTime(0.15, t + 0.02) // Softer volume (0.15 instead of 0.5)
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(t)
      osc1.stop(t + 0.15)

      // Second note (Lower)
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
