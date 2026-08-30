'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendQuoteAction } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Send, Loader2, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react'

// The quote builder's own "send" step. This is where the proposal is
// actually delivered — it calls the single audited `sendQuoteAction`
// (mark quote 'sent' + generate proposal token + email the customer via
// the connected mailbox + advance the lead to 'quote_sent'). The Kanban /
// lead-detail "Send Quote" quick action opens this builder; the staff
// member reviews route/volume/pricing, then sends from here.
export function SendQuoteButton({
  quoteId,
  leadId,
  quoteStatus,
  publicToken,
  hasPricing,
}: {
  quoteId: string
  leadId: string | null
  quoteStatus: string
  publicToken: string | null
  hasPricing: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [result, setResult] = useState<{ url: string; emailSent: boolean } | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const alreadySent = quoteStatus === 'sent' || quoteStatus === 'accepted'
  const proposalUrl =
    result?.url || (publicToken ? `${baseUrl}/proposal/${publicToken}` : null)

  const handleSend = () => {
    if (!leadId) {
      setError('This quote is not linked to a lead, so it cannot be sent from here.')
      return
    }
    setError(null)
    setWarning(null)
    startTransition(async () => {
      const res = await sendQuoteAction({ quoteId, leadId, sendEmail: true })
      if (res.success) {
        setResult({ url: res.url || '', emailSent: !!res.emailSent })
        if (res.error) setWarning(res.error)
        if (!res.emailSent) {
          setWarning(
            (prev) =>
              prev ||
              'Quote marked as sent and proposal link generated, but no email was dispatched (no connected mailbox or no contact email). Share the link below manually.',
          )
        }
        router.refresh()
      } else {
        setError(res.error || 'Failed to send quote')
      }
    })
  }

  const sent = alreadySent || !!result

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50/50 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Send className="h-5 w-5 text-blue-600" /> Send Quote to Customer
        </CardTitle>
        <CardDescription>
          Marks the quote as sent, generates the secure proposal link, emails the customer, and
          moves the lead to <span className="font-medium">Quote Sent</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {warning && (
          <div className="p-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        )}

        {sent ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {result?.emailSent ? 'Proposal emailed to the customer' : 'Quote marked as sent'}
            </div>
            {proposalUrl && (
              <a
                href={proposalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                {proposalUrl}
              </a>
            )}
          </div>
        ) : (
          <>
            {!hasPricing && (
              <p className="text-xs text-amber-700">
                No price has been computed yet — add route &amp; volume above so the customer
                receives a real figure.
              </p>
            )}
            <Button
              onClick={handleSend}
              disabled={isPending || !hasPricing || !leadId}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send Quote &amp; Proposal
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
