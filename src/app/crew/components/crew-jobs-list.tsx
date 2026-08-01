'use client'

import { useEffect, useState } from 'react'
import { getOffline, setOffline } from '@/lib/offline-storage'
import { syncCrewJobs } from '../actions'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { MapPin, Calendar, Clock, RefreshCw } from 'lucide-react'

export function CrewJobsList() {
  const [jobs, setJobs] = useState<any[]>([])
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      // 2. Sync if online
      if (navigator.onLine) {
        syncData()
      }
    }
    
    init()
    
    return () => { mounted = false }
  }, [])

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
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center space-x-2 text-sm text-gray-600">
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
          className="flex items-center space-x-1 text-sm text-orange-600 hover:text-orange-700 disabled:opacity-50"
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
        <div className="p-8 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
          No jobs assigned for the next 7 days.
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <Link 
              key={job.id} 
              href={`/crew/jobs/${job.id}`}
              className="block bg-white p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">
                    {job.contact?.first_name} {job.contact?.last_name}
                  </h3>
                  <p className="text-gray-500 text-sm">Job ID: {job.id.split('-')[0]}</p>
                </div>
                <span className="px-3 py-1 bg-orange-100 text-orange-800 text-xs font-semibold uppercase rounded-full">
                  {job.status.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex items-center space-x-2 text-gray-600 mt-2">
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
