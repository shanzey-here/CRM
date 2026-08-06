'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateJobDetailsSchema, UpdateJobDetailsInput } from '@/modules/jobs/schema'
import { updateJobDetailsAction } from '../../actions'

import { Button, buttonVariants } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

interface EditJobFormProps {
  jobId: string
  internalNotes: string | null
  customerNotes: string | null
}

export function EditJobForm({ jobId, internalNotes, customerNotes }: EditJobFormProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateJobDetailsInput>({
    resolver: zodResolver(updateJobDetailsSchema),
    defaultValues: {
      internal_notes: internalNotes || '',
      customer_notes: customerNotes || '',
    },
  })

  const onSubmit = async (data: UpdateJobDetailsInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)

    const result = await updateJobDetailsAction(jobId, data)

    setIsSubmitting(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to update job')
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}>
        <Edit2 className="h-4 w-4" /> Edit Notes
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Job Notes</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="internal_notes">Special Instructions</Label>
            <Textarea
              id="internal_notes"
              {...register('internal_notes')}
              placeholder="e.g. Narrow driveway, use smaller van. Customer has a dog."
              className="min-h-24"
            />
            {errors.internal_notes && <p className="text-sm text-red-500">{errors.internal_notes.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer_notes">Post-Job Notes</Label>
            <Textarea
              id="customer_notes"
              {...register('customer_notes')}
              placeholder="Outcome, issues encountered, or customer feedback after completion..."
              className="min-h-24"
            />
            {errors.customer_notes && <p className="text-sm text-red-500">{errors.customer_notes.message}</p>}
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
