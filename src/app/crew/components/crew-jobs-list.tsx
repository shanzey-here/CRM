'use client'

import { useEffect, useState, useCallback } from 'react'
import { getOffline, setOffline, getPendingSignoffs, getAllPendingUploads } from '@/lib/offline-storage'
import { syncCrewJobs } from '../actions'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Calendar, Clock, RefreshCw, UploadCloud } from 'lucide-react'

export function CrewJobsList() {
  const [jobs, setJobs] = useState<any[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set of job IDs that have at least one pending-but-unsynced item (photo or signoff) in IDB.
  // This is a display-only overlay — the underlying cached status is never mutated.
  const [pendingJobIds, setPendingJobIds] = useState<Set<string>>(new Set())

  // Read IDB pending stores and update the display overlay set.
  const refreshPendingItemIds = useCallback(async () => {
    try {
      const [signoffs, uploads] = await Promise.all([
        getPendingSignoffs(),
        getAllPendingUploads()
      ])
      const pendingIds = new Set<string>()
      signoffs.forEach(s => pendingIds.add(s.jobId))
      uploads.forEach(u => pendingIds.add(u.jobId))
      setPendingJobIds(pendingIds)
    } catch {
      // Non-fatal — worst case the overlay doesn't show; don't break the list
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function init() {
      // 1. Load instantly from cache
      const cachedJobs = await getOffline<any[]>('crew_jobs_list')
      const cachedSyncTime = await getOffline<string>('crew_jobs_synced_at')
      
      if (mounted) {
        if (cachedJobs) setJobs(cachedJobs)
        if (cachedSyncTime) setSyncedAt(cachedSyncTime)
      }

      // 2. Reflect any pending items immediately (e.g. if user navigated back from detail page)
      await refreshPendingItemIds()

      // 3. Sync if online
      if (navigator.onLine) {
        syncData()
      }
    }
    
    init()

    // Re-check pending items when we come back online (sync may have cleared some)
    const handleOnline = () => refreshPendingItemIds()
    window.addEventListener('online', handleOnline)
    
    return () => {
      mounted = false
      window.removeEventListener('online', handleOnline)
    }
  }, [refreshPendingItemIds])

  async function syncData() {
    setIsSyncing(true)
    setError(null)
    try {
      const result = await syncCrewJobs()
      if (result.success && result.jobsList) {
        setJobs(result.jobsList)
        setSyncedAt(result.syncedAt || new Date().toISOString())

        // Cache the list
        await setOffline('crew_jobs_list', result.jobsList)
        await setOffline('crew_jobs_synced_at', result.syncedAt || new Date().toISOString())

        // Cache the individual job details
        if (result.detailedJobs) {
          for (const [jobId, details] of Object.entries(result.detailedJobs)) {
            await setOffline(`job_details_${jobId}`, details)
          }
        }

        // After a real server sync, any items that were pending may now be
        // confirmed server-side. Re-read IDB so their overlay lifts immediately.
        await refreshPendingItemIds()
      } else {
        setError(result.error || 'Failed to sync')
      }
    } catch (e: any) {
      setError(e.message || 'Network error during sync')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2 text-sm text-slate-600">
          <Clock className="w-4 h-4" />
          <span>
            {syncedAt
              ? `Last synced: ${formatDistanceToNow(new Date(syncedAt), { addSuffix: true })}`
              : 'Never synced'}
          </span>
        </div>
        <button
          onClick={() => syncData()}
          disabled={isSyncing}
          className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
          {error} - Operating from offline cache.
        </div>
      )}

      {jobs.length === 0 && !isSyncing ? (
        <div className="p-8 text-center text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">
          No jobs assigned for the next 7 days.
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <Link
              key={job.id}
              href={`/crew/jobs/${job.id}`}
              className="block bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-slate-200"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {job.contact?.first_name} {job.contact?.last_name}
                  </h3>
                  <p className="text-slate-500 text-sm">Job ID: {job.id.split('-')[0]}</p>
                </div>
                {/* Display-only overlay: amber "Pending Sync" badge if an item is
                    queued locally but not yet confirmed by the server. The real
                    jobs.status is never mutated here — this is purely visual. */}
                {pendingJobIds.has(job.id) ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 border-2 border-amber-400 bg-amber-50 text-amber-800 text-xs font-semibold rounded-full">
                    <UploadCloud className="w-3 h-3" />
                    Pending Sync
                  </span>
                ) : job.status === 'completed' ? (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold uppercase rounded-full">
                    Completed
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold uppercase rounded-full">
                    {job.status.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 text-slate-600 mt-2">
                <Calendar className="w-4 h-4" />
                <span>{job.move_date ? format(new Date(job.move_date), 'EEE, MMM do, yyyy') : 'TBD'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
