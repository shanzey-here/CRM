'use client'

import { use, useEffect, useState } from 'react'
import { getOffline, setOffline } from '@/lib/offline-storage'
import { getCrewJobDetails } from '../../actions'
import { JobSheetContent } from '@/components/shared/job-sheet-content'
import { formatDistanceToNow } from 'date-fns'
import { Clock, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function MobileRunSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  
  const [jobDetails, setJobDetails] = useState<any>(null)
  const [syncedAt, setSyncedAt] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="p-4 sm:p-8 space-y-4 max-w-4xl mx-auto">
      <Link href="/crew" className="inline-flex items-center text-orange-600 hover:text-orange-700 font-medium">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Jobs
      </Link>
      
      {/* Sync Status Toolbar */}
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
          {error}
        </div>
      )}

      {jobDetails && (
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <JobSheetContent jobDetails={jobDetails} />
        </div>
      )}
    </div>
  )
}
