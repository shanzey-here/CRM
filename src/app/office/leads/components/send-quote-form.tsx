'use client'

import * as React from 'react'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Plus,
  Send,
  Copy,
  ExternalLink,
  Check,
  Box,
  Users,
  Clock,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import {
  createQuoteAction,
  getQuotesForLeadAction,
  sendQuoteAction,
  generateProposalLinkAction,
} from '@/app/office/quotes/actions'

interface SendQuoteFormProps {
  lead: LeadWithContact
  onSuccess: () => void
  onCancel: () => void
}

type QuoteSummary = {
  id: string
  status: string
  total_volume: number | null
  total_price: number
  computed_price: number | null
  public_token: string | null
  created_at: string
  updated_at: string | null
}

export function SendQuoteForm({ lead, onSuccess, onCancel }: SendQuoteFormProps) {
  const router = useRouter()
  const [quotes, setQuotes] = useState<QuoteSummary[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(true)
  const [isActionPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Fetch quotes associated with this lead
  useEffect(() => {
    let mounted = true
    async function loadQuotes() {
      setIsLoadingQuotes(true)
      const res = await getQuotesForLeadAction(lead.id)
      if (mounted) {
        if (res.success && res.quotes) {
          setQuotes(res.quotes)
        }
        setIsLoadingQuotes(false)
      }
    }
    loadQuotes()
    return () => {
      mounted = false
    }
  }, [lead.id])

  // Handle creating a new quote and launching the builder
  const handleCreateQuote = () => {
    setActionError(null)
    startTransition(async () => {
      const contact = Array.isArray(lead.contact) ? lead.contact[0] : lead.contact
      const res = await createQuoteAction({
        lead_id: lead.id,
        contact_id: lead.contact_id || contact?.id,
        brand_id: lead.brand_id,
      })

      if (res.success && res.quoteId) {
        onSuccess()
        router.push(`/office/quotes/${res.quoteId}`)
      } else {
        setActionError(res.error || 'Failed to create quote')
      }
    })
  }

  // Handle sending a quote (marks sent, dispatches email, auto-transitions lead)
  const handleSendQuote = (quoteId: string) => {
    setActionError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const res = await sendQuoteAction({
        quoteId,
        leadId: lead.id,
        sendEmail: true,
      })

      if (res.success) {
        setSuccessMessage('Quote marked as sent and lead advanced to Quote Sent!')
        setTimeout(() => {
          onSuccess()
        }, 1200)
      } else {
        setActionError(res.error || 'Failed to send quote')
      }
    })
  }

  // Handle generating/copying the public proposal link
  const handleCopyLink = async (quoteId: string) => {
    setActionError(null)
    try {
      const res = await generateProposalLinkAction(quoteId)
      if (res.success && res.url) {
        await navigator.clipboard.writeText(res.url)
        setCopiedQuoteId(quoteId)
        setTimeout(() => setCopiedQuoteId(null), 2500)
      } else {
        setActionError(res.error || 'Failed to generate proposal link')
      }
    } catch {
      setActionError('Could not copy link to clipboard')
    }
  }

  // Lead reference estimates
  const hasEstimatedVolume = lead.estimated_volume !== null && lead.estimated_volume !== undefined
  const hasEstimatedHours = lead.estimated_hours !== null && lead.estimated_hours !== undefined
  const hasEstimatedCrew = lead.estimated_crew_size !== null && lead.estimated_crew_size !== undefined
  const hasAnyEstimates = hasEstimatedVolume || hasEstimatedHours || hasEstimatedCrew

  return (
    <div className="space-y-4" data-testid="send-quote-form">
      {/* Informative Header / Helper */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-800 space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-blue-900">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <span>Real Process Trigger · Not a raw stage override</span>
        </div>
        <p className="text-blue-700/90 leading-relaxed text-[11.5px]">
          This process action creates or compiles a quote proposal, generates the secure customer link, and automatically transitions the lead stage to <strong>Quote Sent</strong> upon completion.
        </p>
        <div className="flex items-center gap-2 pt-1 text-[11px] font-medium text-blue-950">
          <span>Stage transition:</span>
          <span className="capitalize">{lead.stage.replace(/_/g, ' ')}</span>
          <span>&rarr;</span>
          <span className="text-blue-600 font-semibold">Quote Sent</span>
        </div>
      </div>

      {/* Lead's Initial Estimates Reference Context (if captured) */}
      {hasAnyEstimates && (
        <div
          data-testid="lead-estimates-reference"
          className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs space-y-1.5"
        >
          <div className="flex items-center gap-1.5 font-semibold text-indigo-900 text-[11.5px]">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>Lead&apos;s Initial Estimates (Reference)</span>
          </div>
          <p className="text-[11px] text-indigo-700">
            Captured during initial intake. Informative context for quote preparation:
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {hasEstimatedVolume && (
              <Badge variant="outline" className="bg-white/80 border-indigo-200 text-indigo-800 font-medium text-[11px]">
                <Box className="h-3 w-3 mr-1 text-indigo-500" />
                ~{lead.estimated_volume} cu ft
              </Badge>
            )}
            {hasEstimatedCrew && (
              <Badge variant="outline" className="bg-white/80 border-indigo-200 text-indigo-800 font-medium text-[11px]">
                <Users className="h-3 w-3 mr-1 text-indigo-500" />
                {lead.estimated_crew_size} crew
              </Badge>
            )}
            {hasEstimatedHours && (
              <Badge variant="outline" className="bg-white/80 border-indigo-200 text-indigo-800 font-medium text-[11px]">
                <Clock className="h-3 w-3 mr-1 text-indigo-500" />
                {lead.estimated_hours} hrs
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Error and Success Alerts */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{actionError}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Quotes List Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
            Available Quotes {quotes.length > 0 && `(${quotes.length})`}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateQuote}
            disabled={isActionPending}
            className="h-7 text-xs gap-1 border-slate-200 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            New Quote
          </Button>
        </div>

        {isLoadingQuotes ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <span className="text-xs">Loading lead quotes...</span>
          </div>
        ) : quotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-2">
            <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileText className="h-4 w-4" />
            </div>
            <div className="text-xs font-medium text-slate-700">No quotes prepared yet</div>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Create a quote to calculate route distance, volume inventory, and labor rates in the Quote Builder.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleCreateQuote}
              disabled={isActionPending}
              className="mt-2 bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs"
            >
              {isActionPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create Quote & Open Builder
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
            {quotes.map((q) => {
              const displayPrice = q.computed_price || q.total_price || 0
              const isSent = q.status === 'sent' || q.status === 'accepted'

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-xs text-slate-800">
                        Quote #{q.id.slice(0, 8)}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          isSent
                            ? 'bg-blue-100 text-blue-800 text-[10px] uppercase font-bold'
                            : 'bg-slate-100 text-slate-700 text-[10px] uppercase font-semibold'
                        }
                      >
                        {q.status}
                      </Badge>
                    </div>
                    <div className="font-bold text-sm text-slate-900">
                      ${Number(displayPrice).toFixed(2)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-50 pt-1.5">
                    <span>Volume: {q.total_volume || 0} cu ft</span>
                    <span>Created: {new Date(q.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Actions on this quote */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      data-testid={`send-quote-btn-${q.id}`}
                      disabled={isActionPending}
                      onClick={() => handleSendQuote(q.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 gap-1"
                    >
                      <Send className="h-3 w-3" />
                      {isSent ? 'Resend Proposal' : 'Send Proposal'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isActionPending}
                      onClick={() => handleCopyLink(q.id)}
                      className="text-xs h-7 gap-1 px-2 border-slate-200 hover:bg-slate-50"
                      title="Copy Public Proposal Link"
                    >
                      {copiedQuoteId === q.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-slate-500" />
                          <span>Link</span>
                        </>
                      )}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isActionPending}
                      onClick={() => {
                        onSuccess()
                        router.push(`/office/quotes/${q.id}`)
                      }}
                      className="text-xs h-7 gap-1 px-2 border-slate-200 hover:bg-slate-50"
                      title="Open in Quote Workspace"
                    >
                      <ExternalLink className="h-3 w-3 text-slate-500" />
                      <span>Builder</span>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Actions Footer */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isActionPending}
          className="text-xs h-8"
        >
          Close
        </Button>
      </div>
    </div>
  )
}
