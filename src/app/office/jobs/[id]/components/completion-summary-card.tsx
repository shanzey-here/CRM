'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { regenerateJobCompletionSummaryAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Loader2, RefreshCw, FileCheck } from 'lucide-react'
import type { JobCompletionSummary } from '@/modules/jobs/server/completion-summary'

function fmt(dt: string | null | undefined) {
  if (!dt) return 'Not recorded'
  try {
    return format(new Date(dt), 'MMM d, yyyy h:mm a')
  } catch {
    return dt
  }
}

interface CompletionSummaryCardProps {
  jobId: string
  jobStatus: string
  summary: JobCompletionSummary | null
  generatedAt: string | null
}

export function CompletionSummaryCard({ jobId, jobStatus, summary, generatedAt }: CompletionSummaryCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    setErrorMsg(null)
    const result = await regenerateJobCompletionSummaryAction(jobId)
    setIsRegenerating(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to regenerate summary')
    }
  }

  if (jobStatus !== 'completed') {
    return null
  }

  if (!summary) {
    return (
      <Card className="md:col-span-2 border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-amber-600" />
            Completion Summary
          </CardTitle>
          <CardDescription>
            This job is complete, but the auto-generated summary wasn't created (a background step failed —
            the completion itself is unaffected). You can generate it now.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleRegenerate} disabled={isRegenerating} size="sm">
            {isRegenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <RefreshCw className="mr-2 h-4 w-4" />
            Generate Summary
          </Button>
          {errorMsg && <p className="text-sm text-red-600 mt-3">{errorMsg}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-emerald-600" />
            Completion Summary
          </CardTitle>
          <CardDescription>
            Auto-generated {generatedAt ? fmt(generatedAt) : ''} — frozen at the moment of completion
          </CardDescription>
        </div>
        <Button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          size="sm"
          variant="outline"
          title="Regenerate completion summary"
          aria-label="Regenerate completion summary"
        >
          {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

        {/* Customer & job */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Job</h4>
          <p>Customer: <span className="font-medium">{summary.customer?.name || 'Unknown'}</span></p>
          <p>Status: <span className="font-medium capitalize">{summary.job.status}</span></p>
          <p>Move date: <span className="font-medium">{summary.job.move_date || 'TBD'}</span></p>
        </div>

        <Separator />

        {/* Signoff */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Sign-off</h4>
          {summary.signoff ? (
            <>
              <p>Signed by: <span className="font-medium">{summary.signoff.signature_name}</span></p>
              <p>Signed at: <span className="font-medium">{fmt(summary.signoff.signed_at)}</span></p>
            </>
          ) : (
            <p className="text-slate-400 italic">No signature record found.</p>
          )}
        </div>

        <Separator />

        {/* Crew */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Crew</h4>
          {summary.crew.length > 0 ? (
            <div className="space-y-1">
              {summary.crew.map((c, i) => (
                <p key={i}>
                  <span className="font-medium">{c.name || 'Unnamed'}</span>{' '}
                  <span className="text-slate-500 capitalize">({c.role})</span>
                  {' — Scheduled: '}{fmt(c.scheduled_start)} to {fmt(c.scheduled_end)}
                  {(c.actual_start || c.actual_end) && (
                    <span className="text-emerald-600"> · Actual: {fmt(c.actual_start)} to {fmt(c.actual_end)}</span>
                  )}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 italic">No crew recorded.</p>
          )}
        </div>

        {summary.vehicles.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Vehicles</h4>
              {summary.vehicles.map((v, i) => (
                <p key={i}><span className="font-medium">{v.name}</span> {v.type && <span className="text-slate-500 capitalize">({v.type})</span>}</p>
              ))}
            </div>
          </>
        )}

        <Separator />

        {/* Quote */}
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Quote</h4>
          {summary.quote ? (
            <>
              <p>Total price: <span className="font-medium">${summary.quote.total_price.toLocaleString()}</span></p>
              {summary.quote.deposit_amount != null && (
                <p>Deposit: <span className="font-medium">${summary.quote.deposit_amount.toLocaleString()}</span></p>
              )}
              {summary.quote.total_volume != null && (
                <p>Total volume: <span className="font-medium">{summary.quote.total_volume} cu ft</span></p>
              )}
            </>
          ) : (
            <p className="text-slate-400 italic">No quote linked to this job.</p>
          )}
        </div>

        {summary.inventory.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Inventory (as quoted)</h4>
              <div className="space-y-1">
                {summary.inventory.map((item, i) => (
                  <p key={i}>
                    {item.quantity}× <span className="font-medium">{item.item_name}</span>
                    {item.room && <span className="text-slate-500"> ({item.room})</span>}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}

        {summary.storage && summary.storage.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Storage / Crates</h4>
              {summary.storage.map((c, i) => (
                <p key={i}>
                  Crate <span className="font-medium">{c.crate_number}</span>{' '}
                  <span className="text-slate-500 capitalize">({c.status.replace('_', ' ')})</span>
                </p>
              ))}
            </div>
          </>
        )}

        {(summary.job.internal_notes || summary.job.customer_notes) && (
          <>
            <Separator />
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Notes</h4>
              {summary.job.internal_notes && <p className="whitespace-pre-wrap">Special instructions: {summary.job.internal_notes}</p>}
              {summary.job.customer_notes && <p className="whitespace-pre-wrap mt-1">Post-job notes: {summary.job.customer_notes}</p>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
