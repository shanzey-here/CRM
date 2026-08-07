'use client'

import { useState } from 'react'
import { syncStripePlans } from '../actions'
import { RefreshCw, Loader2 } from 'lucide-react'

export function SyncStripePlansButton() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof syncStripePlans>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await syncStripePlans()
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 hover:text-slate-900 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
      >
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        Sync Stripe Plans
      </button>

      {error && (
        <div className="text-sm text-red-600 max-w-md text-right">{error}</div>
      )}

      {result && (
        <div className="text-sm text-slate-500 max-w-md text-right">
          <p>
            Synced {result.plansSynced} plan{result.plansSynced === 1 ? '' : 's'}, {result.pricesSynced} price{result.pricesSynced === 1 ? '' : 's'}.
          </p>
          {result.skipped.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-amber-600">
              {result.skipped.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
