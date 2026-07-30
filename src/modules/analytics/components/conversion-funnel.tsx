'use client'

import { useState, useEffect } from 'react'
import { getFunnelAction, FunnelResult } from '@/app/office/reports/actions'
import { format, subDays } from 'date-fns'
import { Loader2 } from 'lucide-react'

export function ConversionFunnel() {
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 90), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [isLoading, setIsLoading] = useState(true)
  const [result, setResult] = useState<FunnelResult | null>(null)

  useEffect(() => {
    let mounted = true
    setIsLoading(true)

    getFunnelAction(startDate, endDate).then(res => {
      if (mounted) {
        setResult(res)
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
    }
  }, [startDate, endDate])

  if (result && !result.success && result.code === 'PT403') {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
        Advanced Analytics is not available on your current plan.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Conversion Funnel</h2>
          <p className="text-sm text-zinc-500">Cohort Performance (Leads created in period)</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <span className="text-zinc-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border-zinc-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : result?.success ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Funnel */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-medium text-zinc-500 uppercase tracking-wider">Pipeline</h3>
            
            <div className="space-y-4">
              <div className="relative">
                <div className="flex justify-between items-end mb-1">
                  <span className="font-semibold text-zinc-900">Total Leads</span>
                  <span className="text-lg font-bold text-zinc-900">{result.data.total_leads}</span>
                </div>
                <div className="h-4 w-full bg-indigo-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>

              <div className="relative pl-4">
                <div className="absolute left-0 top-[-1rem] bottom-0 w-px bg-zinc-200" />
                <div className="flex justify-between items-end mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-800">Quoted</span>
                    {result.data.total_leads > 0 && (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {Math.round((result.data.quoted_leads / result.data.total_leads) * 100)}% of Leads
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-zinc-800">{result.data.quoted_leads}</span>
                </div>
                <div className="h-4 w-full bg-indigo-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full" 
                    style={{ width: result.data.total_leads > 0 ? `${(result.data.quoted_leads / result.data.total_leads) * 100}%` : '0%' }} 
                  />
                </div>
              </div>

              <div className="relative pl-8">
                <div className="absolute left-4 top-[-1rem] bottom-0 w-px bg-zinc-200" />
                <div className="flex justify-between items-end mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-700">Accepted</span>
                    {result.data.quoted_leads > 0 && (
                      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {Math.round((result.data.accepted_leads / result.data.quoted_leads) * 100)}% of Quoted
                      </span>
                    )}
                  </div>
                  <span className="text-lg font-bold text-emerald-600">{result.data.accepted_leads}</span>
                </div>
                <div className="h-4 w-full bg-emerald-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full" 
                    style={{ width: result.data.total_leads > 0 ? `${(result.data.accepted_leads / result.data.total_leads) * 100}%` : '0%' }} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sources */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-sm font-medium text-zinc-500 uppercase tracking-wider">Lead Sources</h3>
            <div className="space-y-3">
              {Object.entries(result.data.sources)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700">{source}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-zinc-400 rounded-full" 
                          style={{ width: `${((count as number) / result.data.total_leads) * 100}%` }} 
                        />
                      </div>
                      <span className="font-medium text-zinc-900 w-8 text-right">{count as number}</span>
                    </div>
                  </div>
                ))}
              {Object.keys(result.data.sources).length === 0 && (
                <p className="text-sm text-zinc-500 italic">No leads in this period.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-600">
          {result?.error || 'Failed to load funnel'}
        </div>
      )}
    </div>
  )
}
