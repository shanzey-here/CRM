'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { confirmBookingFormSchema, type ConfirmBookingFormInput } from '@/modules/leads/schemas'
import { confirmBookingAction } from '../actions'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import { getContactDisplayName } from './lead-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2, Loader2, AlertTriangle, MapPin } from 'lucide-react'

interface ConfirmBookingFormProps {
  lead: LeadWithContact
  onSuccess: () => void
  onCancel: () => void
}

function toDateInputValue(v: string | null): string {
  if (!v) return ''
  // leads.preferred_move_date is a DATE column → already 'YYYY-MM-DD', but be defensive.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v)
  return m ? m[1] : ''
}

export function ConfirmBookingForm({ lead, onSuccess, onCancel }: ConfirmBookingFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const contact = Array.isArray(lead.contact) ? lead.contact[0] : lead.contact
  const contactName = getContactDisplayName(lead.contact)

  const originOnFile = !!lead.origin_address_id
  const destinationOnFile = !!lead.destination_address_id

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ConfirmBookingFormInput>({
    resolver: zodResolver(confirmBookingFormSchema),
    defaultValues: {
      title: `Move — ${contactName}`,
      move_date: toDateInputValue(lead.preferred_move_date),
      line_item_description: 'Removal service (agreed)',
      agreed_price: undefined as unknown as number,
      origin_city: '',
      origin_postcode: '',
      destination_city: '',
      destination_postcode: '',
    },
  })

  const onSubmit = (data: ConfirmBookingFormInput) => {
    // Client mirror of the server's "address required when none on file" rule.
    let addressMissing = false
    if (!originOnFile && (!data.origin_city.trim() || !data.origin_postcode.trim())) {
      if (!data.origin_city.trim()) setError('origin_city', { message: 'City is required' })
      if (!data.origin_postcode.trim()) setError('origin_postcode', { message: 'Postcode is required' })
      addressMissing = true
    }
    if (!destinationOnFile && (!data.destination_city.trim() || !data.destination_postcode.trim())) {
      if (!data.destination_city.trim()) setError('destination_city', { message: 'City is required' })
      if (!data.destination_postcode.trim()) setError('destination_postcode', { message: 'Postcode is required' })
      addressMissing = true
    }
    if (addressMissing) return

    setServerError(null)
    setWarning(null)
    startTransition(async () => {
      const res = await confirmBookingAction(lead.id, data)
      if (res.success) {
        router.refresh()
        if (res.warning) {
          // § 2A — job created, stage not moved. Distinct amber state, stay open.
          setWarning(res.warning)
        } else {
          onSuccess()
        }
      } else {
        setServerError(res.error || 'Failed to confirm booking')
      }
    })
  }

  // Post-submit § 2A state: the job exists, only the board label is stale.
  if (warning) {
    return (
      <div className="space-y-4 pt-1">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>The job and its draft invoice were created.</span>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{warning}</span>
        </div>
        <div className="flex items-center justify-end pt-2 border-t border-slate-100">
          <Button type="button" size="sm" onClick={onSuccess} className="bg-slate-900 text-white">
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Read-only context: contact + brand come off the lead, not editable here */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 w-16 shrink-0">Client</span>
          <span className="font-medium text-slate-800">{contactName}</span>
        </div>
        {contact?.email && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 w-16 shrink-0">Email</span>
            <span className="text-slate-600">{contact.email}</span>
          </div>
        )}
        <p className="text-[11px] text-slate-400 pt-0.5">
          A real job and a draft invoice are created for this client, then the lead moves to
          Confirmed Booking. Crew, vehicles and scheduling times are added afterwards on the
          job&apos;s page.
        </p>
      </div>

      {/* Job title */}
      <div className="space-y-1.5">
        <Label htmlFor="cb-title" className="text-xs font-semibold text-slate-700">
          Job title <span className="text-red-500">*</span>
        </Label>
        <Input id="cb-title" {...register('title')} className="h-8 text-xs" />
        {errors.title && <p className="text-[11px] text-red-500">{errors.title.message}</p>}
      </div>

      {/* Move date */}
      <div className="space-y-1.5">
        <Label htmlFor="cb-move-date" className="text-xs font-semibold text-slate-700">
          Move date <span className="text-red-500">*</span>
        </Label>
        <Input id="cb-move-date" type="date" {...register('move_date')} className="h-8 text-xs" />
        {errors.move_date && <p className="text-[11px] text-red-500">{errors.move_date.message}</p>}
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-slate-400" /> Pickup
          </Label>
          {originOnFile ? (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
              On file — will be used
            </p>
          ) : (
            <div className="flex gap-2">
              <Input placeholder="City" {...register('origin_city')} className="h-8 text-xs" />
              <Input placeholder="Postcode" {...register('origin_postcode')} className="h-8 text-xs w-24" />
            </div>
          )}
          {(errors.origin_city || errors.origin_postcode) && (
            <p className="text-[11px] text-red-500">
              {errors.origin_city?.message || errors.origin_postcode?.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-slate-400" /> Delivery
          </Label>
          {destinationOnFile ? (
            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
              On file — will be used
            </p>
          ) : (
            <div className="flex gap-2">
              <Input placeholder="City" {...register('destination_city')} className="h-8 text-xs" />
              <Input placeholder="Postcode" {...register('destination_postcode')} className="h-8 text-xs w-24" />
            </div>
          )}
          {(errors.destination_city || errors.destination_postcode) && (
            <p className="text-[11px] text-red-500">
              {errors.destination_city?.message || errors.destination_postcode?.message}
            </p>
          )}
        </div>
      </div>

      {/* Single summary line item */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">
          Agreed charge <span className="text-red-500">*</span>
        </Label>
        <div className="flex gap-2">
          <Input
            {...register('line_item_description')}
            placeholder="Description"
            className="h-8 text-xs flex-1"
          />
          <Input
            {...register('agreed_price', { valueAsNumber: true })}
            type="number"
            step="0.01"
            min="0"
            placeholder="Price"
            className="h-8 text-xs w-28"
          />
        </div>
        <p className="text-[11px] text-slate-400">
          One summary line for the draft invoice. Itemise it later on the invoice if needed.
        </p>
        {(errors.line_item_description || errors.agreed_price) && (
          <p className="text-[11px] text-red-500">
            {errors.line_item_description?.message || errors.agreed_price?.message}
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium gap-1.5 shadow-sm"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Confirming…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Confirm Booking &amp; Create Job
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
