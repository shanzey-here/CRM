import { useEffect, useState, useCallback } from 'react'
import { getJobPendingUploads, removePendingUpload, updatePendingStatus, PendingUpload } from '@/lib/offline-storage'
import { createClient } from '@/lib/supabase/client'
import { addJobPhotoAction } from '../actions'

export function usePhotoSync(jobId: string, tenantId: string) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const supabase = createClient()

  // Load from IndexedDB
  const loadPending = useCallback(async () => {
    const pending = await getJobPendingUploads(jobId)
    setPendingUploads(pending)
  }, [jobId])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return
    if (isSyncing) return
    
    setIsSyncing(true)
    
    try {
      // Reload pending queue in case something was added
      const queue = await getJobPendingUploads(jobId)
      const toUpload = queue.filter(item => item.status === 'pending' || item.status === 'failed')
      
      for (const item of toUpload) {
        try {
          await updatePendingStatus(item.id, { status: 'uploading', error: undefined })
          setPendingUploads(prev => prev.map(p => p.id === item.id ? { ...p, status: 'uploading', error: undefined } : p))

          const fileExt = item.file.name ? item.file.name.split('.').pop() : 'jpg'
          const fileName = `${crypto.randomUUID()}.${fileExt}`
          const storagePath = `${tenantId}/${jobId}/${fileName}`

          // 1. Direct upload to Storage using authenticated client
          const { error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(storagePath, item.file, { upsert: true })

          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`)
          }

          // 2. Add metadata to DB
          const result = await addJobPhotoAction({
            jobId,
            storagePath,
            caption: item.caption
          })

          if (!result.success) {
            throw new Error(result.error || 'Failed to save photo record')
          }

          // 3. Success - remove from queue
          await removePendingUpload(item.id)
          setPendingUploads(prev => prev.filter(p => p.id !== item.id))

        } catch (err: any) {
          console.error(`Failed to upload photo ${item.id}:`, err)
          await updatePendingStatus(item.id, { status: 'failed', error: err.message })
          setPendingUploads(prev => prev.map(p => p.id === item.id ? { ...p, status: 'failed', error: err.message } : p))
        }
      }
    } finally {
      setIsSyncing(false)
    }
  }, [jobId, tenantId, isSyncing, supabase])

  // Listen for online events
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network connected. Attempting sync...')
      syncNow()
    }

    window.addEventListener('online', handleOnline)
    
    // Also try to sync right away if we're online
    if (navigator.onLine) {
      syncNow()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [syncNow])

  return { pendingUploads, isSyncing, syncNow, loadPending }
}
