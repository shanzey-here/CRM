'use client'

import { use, useEffect, useState } from 'react'
import { getOffline, setOffline } from '@/lib/offline-storage'
import { getCrewJobDetails } from '../../actions'
import { JobSheetContent } from '@/components/shared/job-sheet-content'
import { formatDistanceToNow } from 'date-fns'
import { Clock, RefreshCw, ArrowLeft, UploadCloud, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { usePhotoSync } from '../../hooks/use-photo-sync'
import { PhotoCapture } from './components/photo-capture'
import { JobSignoff } from './components/job-signoff'

export default function MobileRunSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  
  const [jobDetails, setJobDetails] = useState<any>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use our new photo sync hook
  const tenantId = jobDetails?.tenant_id || ''
  const { pendingUploads, isSyncing: isPhotoSyncing, syncNow: syncPhotos, loadPending: loadPendingPhotos } = usePhotoSync(id, tenantId)

  useEffect(() => {
    let mounted = true

    async function init() {
      // 1. Read instantly from cache
      const cached = await getOffline<any>(`job_details_${id}`)
      if (mounted && cached) {
        setJobDetails(cached)
        setSyncedAt(cached.syncedAt || null)
      }

      // 2. Fetch live data if online
      if (navigator.onLine) {
        syncData()
      } else if (!cached && mounted) {
        setError("You are offline and this job wasn't cached.")
      }
    }

    init()
    return () => { mounted = false }
  }, [id])

  async function syncData() {
    setIsSyncing(true)
    setError(null)
    try {
      const result = await getCrewJobDetails(id)
      if (result.success && result.jobDetails) {
        const fullDetails = {
          ...result.jobDetails,
          syncedAt: result.syncedAt
        }
        setJobDetails(fullDetails)
        setSyncedAt(result.syncedAt || null)
        await setOffline(`job_details_${id}`, fullDetails)
      } else {
        setError(result.error || 'Failed to fetch latest data')
      }
    } catch (e: any) {
      setError(e.message || 'Network error')
    } finally {
      setIsSyncing(false)
    }
  }

  if (!jobDetails && !error) {
    return <div className="p-8 text-center text-gray-500">Loading run sheet...</div>
  }

  const uploadedPhotos = jobDetails?.job_photos || []
  const hasPending = pendingUploads.length > 0
  const pendingCount = pendingUploads.filter(p => p.status === 'pending').length
  const uploadingCount = pendingUploads.filter(p => p.status === 'uploading').length
  const failedCount = pendingUploads.filter(p => p.status === 'failed').length

  return (
    <div className="p-4 sm:p-8 space-y-4 max-w-4xl mx-auto pb-24">
      <Link href="/crew" className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
      </Link>
      
      {/* Sync Status Toolbar */}
      <div className="flex flex-col space-y-2 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>
              {syncedAt 
                ? `Last synced: ${formatDistanceToNow(new Date(syncedAt), { addSuffix: true })}` 
                : 'Never synced'}
            </span>
          </div>
          <button 
            onClick={() => { syncData(); syncPhotos(); }}
            disabled={isSyncing || isPhotoSyncing}
            className="flex items-center space-x-1 text-sm text-orange-600 hover:text-orange-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${(isSyncing || isPhotoSyncing) ? 'animate-spin' : ''}`} />
            <span>{(isSyncing || isPhotoSyncing) ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
        
        {/* Pending Uploads Indicator */}
        {hasPending && (
          <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2 text-blue-600 font-medium">
              <UploadCloud className="w-4 h-4" />
              <span>
                {uploadingCount > 0 ? `Uploading ${uploadingCount} photo(s)...` : `${pendingCount} photo(s) pending upload`}
              </span>
            </div>
            {failedCount > 0 && (
              <div className="flex items-center space-x-1 text-red-600 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>{failedCount} failed</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
          {error}
        </div>
      )}

      {jobDetails && (
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <JobSheetContent jobDetails={jobDetails} />
          
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-xl font-bold uppercase text-gray-500 tracking-wider mb-4">Job Photos</h2>
            
            {/* Gallery */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
              {uploadedPhotos.map((photo: any) => (
                <div key={photo.id} className="bg-gray-100 aspect-square rounded-lg flex items-center justify-center p-2 text-center text-xs text-gray-500 overflow-hidden relative border border-gray-200">
                  <span className="z-10">{photo.caption || 'Uploaded Photo'}</span>
                  {/* Actual image loading would require signed URLs. Keeping it simple for MVP. */}
                  <div className="absolute inset-0 bg-gray-50 opacity-50"></div>
                </div>
              ))}
              
              {pendingUploads.map(pending => (
                <div key={pending.id} className={`bg-blue-50 aspect-square rounded-lg flex flex-col items-center justify-center p-2 text-center text-xs border ${pending.status === 'failed' ? 'border-red-300' : 'border-blue-200'} relative overflow-hidden`}>
                  {/* Optimistic local rendering */}
                  <img src={URL.createObjectURL(pending.file as Blob)} className="absolute inset-0 w-full h-full object-cover opacity-40" alt="Pending" />
                  <div className="z-10 bg-white/80 p-1 rounded font-medium">
                    {pending.status === 'failed' ? <span className="text-red-600">Failed</span> : <span className="text-blue-600">Pending</span>}
                    {pending.caption && <div className="truncate w-20 text-[10px] text-gray-600 mt-1">{pending.caption}</div>}
                  </div>
                </div>
              ))}
              
              {uploadedPhotos.length === 0 && pendingUploads.length === 0 && (
                <div className="col-span-full py-4 text-center text-gray-500 italic text-sm">
                  No photos attached to this job yet.
                </div>
              )}
            </div>

            <PhotoCapture jobId={id} onPhotoQueued={() => {
              loadPendingPhotos()
              syncPhotos()
            }} />
          </div>

          <JobSignoff jobId={id} status={jobDetails.status} onSyncComplete={syncData} />
        </div>
      )}
    </div>
  )
}
