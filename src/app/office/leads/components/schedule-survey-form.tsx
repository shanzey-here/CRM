'use client'

import * as React from 'react'
import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  scheduleSurveyFormSchema,
  type ScheduleSurveyFormInput,
} from '@/modules/appointments/schemas'
import { scheduleSurveyAction } from '@/modules/appointments/server/actions'
import { getTenantStaffAction } from '@/modules/users/server/actions'
import type { TenantUser } from '@/modules/users/server/repository'
import type { LeadWithContact } from '@/modules/leads/server/repository'
import { getContactDisplayName } from './lead-card'
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
import {
  CalendarClock,
  User,
  Clock,
  AlertTriangle,
  Loader2,
  Check,
  CheckCircle2,
} from 'lucide-react'

interface ScheduleSurveyFormProps {
  lead: LeadWithContact
  tenantStaff?: TenantUser[]
  onSuccess: () => void
  onCancel: () => void
}

function getDefaultStartAndEndTime(preferredMoveDate?: string | null) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const pad = (n: number) => n.toString().padStart(2, '0')
  const toLocalInputFormat = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

  let surveyDate = tomorrow
  if (preferredMoveDate) {
    const moveDateObj = new Date(preferredMoveDate)
    if (!isNaN(moveDateObj.getTime())) {
      const priorDate = new Date(moveDateObj)
      priorDate.setDate(priorDate.getDate() - 7)
      priorDate.setHours(10, 0, 0, 0)
      if (priorDate.getTime() > Date.now()) {
        surveyDate = priorDate
      }
    }
  }

  const endSurveyDate = new Date(surveyDate)
  endSurveyDate.setHours(endSurveyDate.getHours() + 1)

  return {
    startTime: toLocalInputFormat(surveyDate),
    endTime: toLocalInputFormat(endSurveyDate),
  }
}

export function ScheduleSurveyForm({
  lead,
  tenantStaff: initialStaff,
  onSuccess,
  onCancel,
}: ScheduleSurveyFormProps) {
  const router = useRouter()
  const [staffList, setStaffList] = useState<TenantUser[]>(initialStaff || [])
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [conflictWarning, setConflictWarning] = useState<boolean>(false)
  const [partialWarning, setPartialWarning] = useState<string | null>(null)
  const [lastSubmittedData, setLastSubmittedData] = useState<ScheduleSurveyFormInput | null>(null)

  const contactName = getContactDisplayName(lead.contact)
  const defaultTimes = getDefaultStartAndEndTime(lead.preferred_move_date)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<ScheduleSurveyFormInput>({
    resolver: zodResolver(scheduleSurveyFormSchema),
    defaultValues: {
      title: `Survey - ${contactName}`,
      contact_id: lead.contact_id,
      assigned_to: lead.assigned_to || 'unassigned',
      start_time: defaultTimes.startTime,
      end_time: defaultTimes.endTime,
      description: lead.notes ? `Lead notes: ${lead.notes}` : '',
    },
  })

  const assignedToValue = watch('assigned_to')

  // Fetch staff list if not passed in props
  useEffect(() => {
    if (!initialStaff || initialStaff.length === 0) {
      getTenantStaffAction().then((res) => {
        if (res.success && res.data) {
          setStaffList(res.data)
        }
      })
    }
  }, [initialStaff])

  const onSubmit = (data: ScheduleSurveyFormInput, ignoreConflict: boolean = false) => {
    setServerError(null)
    setConflictWarning(false)
    setPartialWarning(null)
    setLastSubmittedData(data)

    startTransition(async () => {
      try {
        // Convert datetime strings to ISO UTC format for repository
        const isoStartTime = new Date(data.start_time).toISOString()
        const isoEndTime = new Date(data.end_time).toISOString()
        const assignedTo =
          data.assigned_to === 'unassigned' || !data.assigned_to
            ? null
            : data.assigned_to

        const payload = {
          title: data.title.trim(),
          contact_id: lead.contact_id,
          assigned_to: assignedTo,
          start_time: isoStartTime,
          end_time: isoEndTime,
          description: data.description?.trim() || null,
          status: 'scheduled' as const,
        }

        const res = await scheduleSurveyAction({
          leadId: lead.id,
          payload,
          ignoreConflict,
        })

        if (!res.success) {
          if (res.conflict) {
            setConflictWarning(true)
          } else {
            setServerError(res.error || 'Failed to schedule survey appointment')
          }
        } else if (res.warning) {
          // § 2A — the appointment was created but the stage transition failed
          // even after the retry. Surface it in a distinct panel; do NOT close
          // the modal as if everything succeeded.
          router.refresh()
          setPartialWarning(res.warning)
        } else {
          onSuccess()
        }
      } catch (err: any) {
        setServerError(err.message || 'An unexpected error occurred')
      }
    })
  }

  const handleOverrideConflict = () => {
    if (lastSubmittedData) {
      onSubmit(lastSubmittedData, true)
    }
  }

  // Post-submit § 2A state: the appointment exists, only the lead's board
  // label is stale. Distinct from a hard error — stay open, offer Close.
  if (partialWarning) {
    return (
      <div className="space-y-4 pt-1">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>The survey appointment was created on the calendar.</span>
        </div>
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{partialWarning}</span>
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
    <form onSubmit={handleSubmit((d) => onSubmit(d, false))} className="space-y-4 pt-1">
      {/* Error Banner */}
      {serverError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          ⚠ {serverError}
        </div>
      )}

      {/* Conflict Warning Banner */}
      {conflictWarning && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-2">
          <div className="flex items-start gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>Surveyor Schedule Conflict Detected</span>
          </div>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            The selected staff member has an overlapping crew assignment or job during this time window. You can adjust the time/surveyor, or override and schedule anyway.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 border-amber-300 bg-white hover:bg-amber-100/50"
              onClick={handleOverrideConflict}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Check className="h-3.5 w-3.5 mr-1" />
              )}
              Proceed Anyway (Override)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-amber-900 hover:bg-amber-100/50"
              onClick={() => setConflictWarning(false)}
            >
              Change Time / Surveyor
            </Button>
          </div>
        </div>
      )}

      {/* Survey Title */}
      <div className="space-y-1.5">
        <Label htmlFor="survey-title" className="text-xs font-semibold text-slate-700">
          Survey Appointment Title
        </Label>
        <Input
          id="survey-title"
          {...register('title')}
          placeholder="e.g. Survey - Jane Doe"
          className="h-8 text-xs"
        />
        {errors.title && (
          <p className="text-[11px] text-red-500">{errors.title.message}</p>
        )}
      </div>

      {/* Surveyor Assignment */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
          <User className="h-3.5 w-3.5 text-slate-400" />
          Assign Surveyor
        </Label>
        <Select
          value={assignedToValue || 'unassigned'}
          onValueChange={(val) => setValue('assigned_to', val === 'unassigned' ? null : val)}
        >
          <SelectTrigger className="w-full h-8 text-xs">
            <SelectValue placeholder="Select surveyor..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned (Anyone)</SelectItem>
            {staffList.map((staff) => (
              <SelectItem key={staff.id} value={staff.id}>
                {staff.full_name || staff.email} ({staff.role.replace(/_/g, ' ')})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.assigned_to && (
          <p className="text-[11px] text-red-500">{errors.assigned_to.message}</p>
        )}
      </div>

      {/* Date & Time Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="survey-start-time" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            Start Date & Time
          </Label>
          <Input
            id="survey-start-time"
            type="datetime-local"
            {...register('start_time')}
            className="h-8 text-xs"
          />
          {errors.start_time && (
            <p className="text-[11px] text-red-500">{errors.start_time.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="survey-end-time" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            End Date & Time
          </Label>
          <Input
            id="survey-end-time"
            type="datetime-local"
            {...register('end_time')}
            className="h-8 text-xs"
          />
          {errors.end_time && (
            <p className="text-[11px] text-red-500">{errors.end_time.message}</p>
          )}
        </div>
      </div>

      {/* Description / Survey Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="survey-description" className="text-xs font-semibold text-slate-700">
          Survey Notes / Access Instructions
        </Label>
        <Textarea
          id="survey-description"
          {...register('description')}
          placeholder="e.g. Parking on driveway, video survey via WhatsApp, specific heavy items to assess..."
          rows={2}
          className="text-xs resize-none"
        />
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scheduling...
            </>
          ) : (
            <>
              <CalendarClock className="h-3.5 w-3.5" />
              Schedule Survey Appointment
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
