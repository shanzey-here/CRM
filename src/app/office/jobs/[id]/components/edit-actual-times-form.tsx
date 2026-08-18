'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateJobCrewActualTimesSchema, UpdateJobCrewActualTimesInput } from '@/modules/scheduling/schema'
import { updateJobCrewActualTimesAction } from '../../../scheduling/actions'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditActualTimesFormProps {
  jobId: string
  assignmentId: string
  actualStart: string | null
  actualEnd: string | null
}

// datetime-local inputs need 'YYYY-MM-DDTHH:mm', not a full ISO string
function toLocalInputValue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditActualTimesForm({ jobId, assignmentId, actualStart, actualEnd }: EditActualTimesFormProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
  } = useForm<{ actual_start: string; actual_end: string }>({
    defaultValues: {
      actual_start: toLocalInputValue(actualStart),
      actual_end: toLocalInputValue(actualEnd),
    },
  })

  const onSubmit = async (data: { actual_start: string; actual_end: string }) => {
    setIsSubmitting(true)
    setErrorMsg(null)

    const payload: UpdateJobCrewActualTimesInput = {
      actual_start: data.actual_start ? new Date(data.actual_start).toISOString() : null,
      actual_end: data.actual_end ? new Date(data.actual_end).toISOString() : null,
    }

    const parsed = updateJobCrewActualTimesSchema.safeParse(payload)
    if (!parsed.success) {
      setIsSubmitting(false)
      setErrorMsg(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    const result = await updateJobCrewActualTimesAction(assignmentId, jobId, parsed.data)

    setIsSubmitting(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to update actual times')
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn('text-slate-400 hover:text-slate-700 transition-colors')}
        aria-label="Edit actual start/finish times"
      >
        <Clock className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Actual Start / Finish</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="actual_start">Actual Start</Label>
            <Input id="actual_start" type="datetime-local" {...register('actual_start')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="actual_end">Actual Finish</Label>
            <Input id="actual_end" type="datetime-local" {...register('actual_end')} />
          </div>

          {errorMsg && (
            <div className="p-3 text-sm bg-red-50 border border-red-200 text-red-600 rounded-md">
              {errorMsg}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
