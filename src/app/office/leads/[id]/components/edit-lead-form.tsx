'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateLeadDetailsSchema, UpdateLeadDetailsInput } from '@/modules/leads/schemas'
import { Lead } from '@/modules/leads/server/repository'
import { updateLeadDetailsAction } from '../../actions'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Edit2 } from 'lucide-react'

export function EditLeadForm({ lead }: { lead: Lead }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateLeadDetailsInput>({
    resolver: zodResolver(updateLeadDetailsSchema),
    defaultValues: {
      notes: lead.notes || '',
      preferred_move_date: lead.preferred_move_date || '',
      estimated_volume: lead.estimated_volume || undefined,
      assigned_to: lead.assigned_to || '',
      source: lead.source || '',
    },
  })

  const onSubmit = async (data: UpdateLeadDetailsInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)

    const result = await updateLeadDetailsAction(lead.id, data)

    setIsSubmitting(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to update lead')
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* @ts-expect-error Radix UI type mismatch with React 19 */}
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit2 className="h-4 w-4" /> Edit Details
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Lead Details</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Input id="source" {...register('source')} placeholder="e.g. website_form, referral..." />
            {errors.source && <p className="text-sm text-red-500">{errors.source.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_move_date">Preferred Move Date</Label>
              <Input id="preferred_move_date" type="date" {...register('preferred_move_date')} />
              {errors.preferred_move_date && (
                <p className="text-sm text-red-500">{errors.preferred_move_date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated_volume">Est. Volume (m³)</Label>
              <Input
                id="estimated_volume"
                type="number"
                step="0.01"
                {...register('estimated_volume', { valueAsNumber: true })}
              />
              {errors.estimated_volume && (
                <p className="text-sm text-red-500">{errors.estimated_volume.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_to">Assigned To (User ID)</Label>
            <Input id="assigned_to" {...register('assigned_to')} placeholder="Leave blank for unassigned" />
            {errors.assigned_to && <p className="text-sm text-red-500">{errors.assigned_to.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Internal notes about this lead..."
              className="min-h-24"
            />
            {errors.notes && <p className="text-sm text-red-500">{errors.notes.message}</p>}
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
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
