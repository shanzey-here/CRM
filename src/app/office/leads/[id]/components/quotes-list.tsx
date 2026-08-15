'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { createQuoteAction } from '../../../quotes/actions'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { formatZodIssues } from '@/lib/format-zod-error'

type Quote = {
  id: string
  status: string
  total_volume: number | null
  total_price: number
  created_at: string
}

export function QuotesList({
  leadId,
  contactId,
  brandId,
  quotes,
}: {
  leadId: string
  contactId: string
  brandId: string
  quotes: Quote[]
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleCreateQuote = () => {
    setError(null)
    startTransition(async () => {
      const result = await createQuoteAction({ lead_id: leadId, contact_id: contactId, brand_id: brandId })
      if (result.success && result.quoteId) {
        router.push(`/office/quotes/${result.quoteId}`)
      } else {
        setError('details' in result && result.details ? formatZodIssues(result.details) : result.error || 'Failed to create quote')
      }
    })
  }

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" /> Quotes
          </CardTitle>
          <CardDescription>Manage proposals for this lead</CardDescription>
        </div>
        <Button size="sm" onClick={handleCreateQuote} disabled={isPending}>
          <Plus className="h-4 w-4 mr-1" /> New Quote
        </Button>
      </CardHeader>
      {error && (
        <div className="mx-4 mt-4 p-3 text-sm bg-red-50 border border-red-200 text-red-600 rounded-md">
          {error}
        </div>
      )}
      <CardContent className="pt-4 p-0">
        {quotes && quotes.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {quotes.map((q) => (
              <Link
                key={q.id}
                href={`/office/quotes/${q.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-slate-900">
                      Quote #{q.id.split('-')[0]}
                    </p>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {q.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(q.created_at).toLocaleDateString()} • {q.total_volume || 0} cft
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-900">
                    ${q.total_price.toFixed(2)}
                  </p>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            No quotes created yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
