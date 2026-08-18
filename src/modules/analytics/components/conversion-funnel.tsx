'use client'

import { useState, useEffect } from 'react'
import { getFunnelAction, FunnelResult } from '@/app/office/reports/actions'
import { format, subDays } from 'date-fns'
import { Loader2 } from 'lucide-react'

export function ConversionFunnel({ startDate, endDate }: { startDate: string; endDate: string }) {
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
      <div className="rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
        Advanced Analytics is not available on your current plan.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Conversion Funnel</h2>
          <p className="text-sm text-muted-foreground">Cohort Performance (Leads created in period)</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : result?.success ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Funnel */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col group/funnel transition-all duration-300 hover:shadow-md">
            <h3 className="mb-6 text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Pipeline
            </h3>

            <div className="space-y-6">
              <div className="relative">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-semibold text-foreground tracking-tight">Total Leads</span>
                  <span className="text-xl font-bold text-foreground" style={{ fontVariantNumeric: 'proportional-nums' }}>{result.data.total_leads}</span>
                </div>
                <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div className="h-full bg-gradient-to-r from-slate-400 to-slate-500 rounded-full transition-all duration-1000 ease-out" style={{ width: '100%' }} />
                </div>
              </div>

              <div className="relative pl-6">
                <div className="absolute left-2 top-[-1.5rem] bottom-0 w-px bg-gradient-to-b from-slate-200 to-blue-200 dark:from-slate-700 dark:to-blue-900" />
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground/90 tracking-tight">Quoted</span>
                    {result.data.total_leads > 0 && (
                      <span className="text-xs font-medium text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/40 px-2.5 py-0.5 rounded-full ring-1 ring-inset ring-blue-600/20">
                        {Math.round((result.data.quoted_leads / result.data.total_leads) * 100)}%
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-bold text-foreground/90" style={{ fontVariantNumeric: 'proportional-nums' }}>{result.data.quoted_leads}</span>
                </div>
                <div className="h-4 w-full bg-blue-50 dark:bg-blue-950/50 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm shadow-blue-500/20 rounded-full transition-all duration-1000 ease-out delay-150"
                    style={{ width: result.data.total_leads > 0 ? `${(result.data.quoted_leads / result.data.total_leads) * 100}%` : '0%' }}
                  />
                </div>
              </div>

              <div className="relative pl-12">
                <div className="absolute left-2 top-[-1.5rem] bottom-0 w-px bg-gradient-to-b from-blue-200 to-emerald-200 dark:from-blue-900 dark:to-emerald-900" />
                <div className="absolute left-8 top-[-1.5rem] bottom-0 w-px bg-gradient-to-b from-slate-200 to-emerald-200 dark:from-slate-700 dark:to-emerald-900" />
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground/80 tracking-tight">Accepted</span>
                    {result.data.quoted_leads > 0 && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full ring-1 ring-inset ring-emerald-600/20">
                        {Math.round((result.data.accepted_leads / result.data.quoted_leads) * 100)}%
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400" style={{ fontVariantNumeric: 'proportional-nums' }}>{result.data.accepted_leads}</span>
                </div>
                <div className="h-4 w-full bg-emerald-50 dark:bg-emerald-950/50 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-sm shadow-emerald-500/20 rounded-full transition-all duration-1000 ease-out delay-300"
                    style={{ width: result.data.total_leads > 0 ? `${(result.data.accepted_leads / result.data.total_leads) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sources */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col group/sources transition-all duration-300 hover:shadow-md">
            <h3 className="mb-6 text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
              Lead Sources
            </h3>
            <div className="space-y-3">
              {Object.entries(result.data.sources)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between text-sm group/source">
                    <span className="text-foreground/80 font-medium group-hover/source:text-foreground transition-colors">{source}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-600 dark:to-slate-500 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${((count as number) / result.data.total_leads) * 100}%` }}
                        />
                      </div>
                      <span className="font-semibold text-foreground w-8 text-right" style={{ fontVariantNumeric: 'proportional-nums' }}>{count as number}</span>
                    </div>
                  </div>
                ))}
              {Object.keys(result.data.sources).length === 0 && (
                <p className="text-sm text-muted-foreground italic">No leads in this period.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 p-6 text-sm text-red-600 dark:text-red-400">
          {result?.error || 'Failed to load funnel'}
        </div>
      )}
    </div>
  )
}
