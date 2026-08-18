import { Metadata, Viewport } from 'next'
import { OfflineIndicator } from './components/offline-indicator'
import { ReactNode } from 'react'
import { SwRegister } from './components/sw-register'

export const metadata: Metadata = {
  title: 'GoMove Crew Portal',
  description: 'Mobile offline-capable portal for GoMove moving crews',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#ea580c',
}

export default function CrewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <OfflineIndicator />
      <SwRegister />

      <main className="flex-1 w-full max-w-md mx-auto bg-white shadow-xl relative min-h-screen">
        {children}
      </main>
    </div>
  )
}
