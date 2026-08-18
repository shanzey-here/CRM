'use client'

import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Check initial state
    if (typeof window !== 'undefined') {
      setIsOffline(!window.navigator.onLine)
    }

    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div className="bg-white border-b-4 border-red-500 text-red-700 px-4 py-2 flex items-center justify-center gap-2 text-sm font-bold z-50 sticky top-0 shadow-md">
      <WifiOff size={16} className="text-red-600" />
      <span>You are currently offline. Changes will be saved locally.</span>
    </div>
  )
}
