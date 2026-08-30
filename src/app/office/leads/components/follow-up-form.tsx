'use client'

import * as React from 'react'
import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { followUpFormSchema, type FollowUpFormInput } from '@/modules/leads/schemas'
import { logFollowUpAction } from '../actions'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PhoneCall, Loader2, Check, AlertTriangle } from 'lucide-react'

interface FollowUpFormProps {
  lead: LeadWithContact
  onSuccess: () => void
  onCancel: () => void
}

const CONTACT_METHOD_LABELS: Record<FollowUpFormInput['contact_method'], string> = {
  phone: 'Phone call',
  email: 'Email',
  text: 'Text / SMS',
}

export function FollowUpForm({ lead, onSuccess, onCancel }: FollowUpFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FollowUpFormInput>({
    resolver: zodResolver(followUpFormSchema),
    defaultValues: {
      note: '',
      contact_method: 'phone',
      reminder_date: '',
    },
  })

  const contactMethod = watch('contact_method')

  const onSubmit = (data: FollowUpFormInput) => {
    setServerError(null)
    startTransition(async () => {
      const res = await logFollowUpAction(lead.id, {
        ...data,
        reminder_date: data.reminder_date || null,
      })
      if (res.success) {
        // A non-fatal stage-transition warning still counts as done — the
        // follow-up itself is recorded. Surface it, then close.
        onSuccess()
      } else {
        setServerError(res.error || 'Failed to log follow-up')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="follow-up-note" className="text-xs font-semibold text-slate-700">
          What happened? <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="follow-up-note"
          {...register('note')}
          placeholder="e.g. Called the customer, left a voicemail. Will try again Thursday afternoon."
          rows={3}
          className="text-xs resize-none"
        />
        {errors.note && <p className="text-[11px] text-red-500">{errors.note.message}</p>}
      </div>

      {/* Contact method */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700">How did you make contact?</Label>
        <Select
          value={contactMethod}
          onValueChange={(val) => setValue('contact_method', val as FollowUpFormInput['contact_method'])}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue>{CONTACT_METHOD_LABELS[contactMethod]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CONTACT_METHOD_LABELS) as FollowUpFormInput['contact_method'][]).map((m) => (
              <SelectItem key={m} value={m}>
                {CONTACT_METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.contact_method && (
          <p className="text-[11px] text-red-500">{errors.contact_method.message}</p>
        )}
      </div>

      {/* Reminder date (optional) */}
      <div className="space-y-1.5">
        <Label htmlFor="follow-up-reminder" className="text-xs font-semibold text-slate-700">
          Remind me to follow up again on{' '}
          <span className="font-normal text-slate-400">(optional)</span>
        </Label>
        <Input
          id="follow-up-reminder"
          type="date"
          {...register('reminder_date')}
          className="h-8 text-xs"
        />
        <p className="text-[11px] text-slate-400">
          Creates a task on your dashboard. Leave blank if no further follow-up is needed.
        </p>
        {errors.reminder_date && (
          <p className="text-[11px] text-red-500">{errors.reminder_date.message}</p>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white font-medium gap-1.5 shadow-sm"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Logging…
            </>
          ) : (
            <>
              <PhoneCall className="h-3.5 w-3.5" />
              Log Follow-Up
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
