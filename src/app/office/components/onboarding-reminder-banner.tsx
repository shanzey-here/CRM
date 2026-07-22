'use client'

import { useState } from 'react'
import { X, ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { dismissOnboardingReminderAction } from '../onboarding/actions'
import { useRouter } from 'next/navigation'

export function OnboardingReminderBanner() {
  const [isDismissing, setIsDismissing] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const router = useRouter()

  const handleDismiss = async () => {
    setIsDismissing(true)
    try {
      await dismissOnboardingReminderAction()
      setIsDismissed(true)
      router.refresh()
    } catch (err) {
      console.error('Failed to dismiss banner', err)
      setIsDismissing(false)
    }
  }

  if (isDismissed) return null

  return (
    <div className="bg-blue-900/40 border border-blue-800/50 rounded-lg p-4 flex items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start sm:items-center gap-3">
        <div className="bg-blue-600/20 p-2 rounded-full hidden sm:block">
          <CheckCircle2 className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-white">Complete your workspace setup</h3>
          <p className="text-xs text-blue-200 mt-1">
            You skipped the onboarding wizard. We recommend configuring your branding, rates, and catalog before generating quotes.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        <Link 
          href="/office/onboarding" 
          className="text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
        >
          Resume Setup <ArrowRight size={14} />
        </Link>
        <button 
          onClick={handleDismiss} 
          disabled={isDismissing}
          className="text-blue-400 hover:text-white transition-colors p-1"
          title="Dismiss permanently"
        >
          <X size={16} className={isDismissing ? "opacity-50" : ""} />
        </button>
      </div>
    </div>
  )
}
