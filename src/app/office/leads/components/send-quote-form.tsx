'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createQuoteAction } from '../../quotes/actions'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import { getContactDisplayName } from './lead-card'
import { formatZodIssues } from '@/lib/format-zod-error'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Loader2,
  MapPin,
  Calendar,
  Mail,
  Phone,
  ArrowRight,
} from 'lucide-react'

interface SendQuoteFormProps {
  lead: LeadWithContact
  onSuccess: () => void
  onCancel: () => void
}

function formatMoveDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Card-level entry point for the "Send Quote" quick action. This does NOT
// implement a second quote form — it launches the one real quote-creation
// flow (`createQuoteAction` -> `/office/quotes/[id]` builder), exactly the
// same call the lead detail page's "New Quote" button makes
// (src/app/office/leads/[id]/components/quotes-list.tsx). The proposal is
// actually sent from the builder's own "Send Quote to Customer" step once
// route/volume/pricing are ready.
export function SendQuoteForm({ lead, onSuccess, onCancel }: SendQuoteFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const contact = Array.isArray(lead.contact) ? lead.contact[0] : lead.contact
  const contactName = getContactDisplayName(lead.contact)

  // Only surface fields the lead genuinely has real data for. Missing
  // fields are shown as explicitly missing — never a placeholder that
  // looks like captured data.
  const moveDate = formatMoveDate(lead.preferred_move_date)
  const hasOrigin = !!lead.origin_address_id
  const hasDestination = !!lead.destination_address_id

  const handleOpenBuilder = () => {
    setError(null)
    startTransition(async () => {
      const result = await createQuoteAction({
        lead_id: lead.id,
        contact_id: lead.contact_id,
        brand_id: lead.brand_id,
      })
      if (result.success && result.quoteId) {
        onSuccess()
        router.push(`/office/quotes/${result.quoteId}`)
      } else {
        setError(
          'details' in result && result.details
            ? formatZodIssues(result.details)
            : result.error || 'Failed to open the quote builder',
        )
      }
    })
  }

  return (
    <div className="space-y-4 pt-1">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          ⚠ {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 text-xs">
        <div className="font-semibold text-slate-700 uppercase tracking-wider text-[10px]">
          Known lead data — carried into the quote
        </div>

        <div className="flex items-start gap-2">
          <span className="text-slate-400 w-20 shrink-0 pt-0.5">Contact</span>
          <div className="space-y-0.5">
            <span className="font-medium text-slate-800 block">{contactName}</span>
            {contact?.email && (
              <span className="text-slate-500 flex items-center gap-1">
                <Mail className="h-3 w-3 text-slate-400" />
                {contact.email}
              </span>
            )}
            {contact?.phone && (
              <span className="text-slate-500 flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-400" />
                {contact.phone}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 w-20 shrink-0">Move date</span>
          {moveDate ? (
            <span className="text-slate-700 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-slate-400" />
              {moveDate}
            </span>
          ) : (
            <span className="text-slate-400 italic">Not captured — builder opens this empty</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 w-20 shrink-0">Route</span>
          <span className="text-slate-700 flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
            {hasOrigin ? (
              <span>Origin on file</span>
            ) : (
              <span className="text-slate-400 italic">Origin not captured</span>
            )}
            <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
            {hasDestination ? (
              <span>Destination on file</span>
            ) : (
              <span className="text-slate-400 italic">Destination not captured</span>
            )}
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed pt-1.5 border-t border-slate-100">
          Opens the full quote builder (route, volume &amp; pricing). Only real captured data is
          carried over — anything not captured opens empty. You send the proposal to the customer
          from the builder once it&apos;s ready.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium gap-1.5 shadow-sm"
          onClick={handleOpenBuilder}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Opening builder…
            </>
          ) : (
            <>
              <FileText className="h-3.5 w-3.5" />
              Open Quote Builder
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
