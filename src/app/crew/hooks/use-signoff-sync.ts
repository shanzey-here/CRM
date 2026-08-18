'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getPendingSignoffs, updateSignoffStatus, removePendingSignoff } from '@/lib/offline-storage'
import { addJobSignoffAction } from '../actions'
import { useRouter } from 'next/navigation'

export function useSignoffSync(jobId?: string, onSyncComplete?: () => void) {
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncInProgress = useRef(false)

  const loadPending = useCallback(async () => {
    try {
      const signoffs = await getPendingSignoffs(jobId)
      setPendingCount(signoffs.length)
    } catch (e) {
      console.error('Failed to load pending signoffs', e)
    }
  }, [jobId])

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return
    if (syncInProgress.current) return

    try {
      syncInProgress.current = true
      setIsSyncing(true)
      
      const pending = await getPendingSignoffs(jobId)
      if (pending.length === 0) return

      for (const signoff of pending) {
        if (signoff.status === 'syncing') continue

        try {
          await updateSignoffStatus(signoff.id, 'syncing')
          
          const result = await addJobSignoffAction({
            jobId: signoff.jobId,
            signatureName: signoff.signatureName,
            base64Image: signoff.base64Image
          })

          if (!result.success) {
            throw new Error(`Upload failed: ${result.error}`)
          }

          await removePendingSignoff(signoff.id)
          
          // Trigger callback to parent component so it can re-fetch
          onSyncComplete?.()
          // We also trigger router.refresh() just in case any server components need it
          router.refresh()
        } catch (e: any) {
          console.error(`Failed to sync signoff ${signoff.id}:`, e)
          await updateSignoffStatus(signoff.id, 'failed', e.message)
        }
      }
    } finally {
      setIsSyncing(false)
      syncInProgress.current = false
      await loadPending()
    }
  }, [jobId, loadPending, router])

  useEffect(() => {
    loadPending()
    
    // Attempt sync immediately if online
    if (navigator.onLine) {
      syncNow()
    }

    // Attempt sync whenever we come back online
    window.addEventListener('online', syncNow)
    return () => {
      window.removeEventListener('online', syncNow)
    }
  }, [loadPending, syncNow])

  return {
    pendingCount,
    isSyncing,
    syncNow,
    loadPending
  }
}
