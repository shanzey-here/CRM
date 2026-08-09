'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClientAction } from '../actions'

import { Button, buttonVariants } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

import { createClientFormSchema, type CreateClientFormInput } from '@/modules/clients/schemas'

export function CreateClientForm() {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateClientFormInput>({
    resolver: zodResolver(createClientFormSchema),
    defaultValues: {
      type: 'residential',
      stage: 'inquiry',
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      notes: '',
    },
  })

  const currentType = watch('type')
  const currentStage = watch('stage')

  const onSubmit = async (data: CreateClientFormInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)

    // Normalize empty strings to null for nullable numbers
    if (data.estimated_hours === '' as any || isNaN(data.estimated_hours as any)) data.estimated_hours = null
    if (data.estimated_crew_size === '' as any || isNaN(data.estimated_crew_size as any)) data.estimated_crew_size = null
    if (data.quote_amount === '' as any || isNaN(data.quote_amount as any)) data.quote_amount = null
    if (data.email === '') data.email = null
    if (data.origin_city === '') data.origin_city = null
    if (data.origin_postcode === '') data.origin_postcode = null
    if (data.destination_city === '') data.destination_city = null
    if (data.destination_postcode === '') data.destination_postcode = null

    const result = await createClientAction(data)

    setIsSubmitting(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to create client')
    } else {
      reset()
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'default' }), 'gap-2 bg-emerald-600 hover:bg-emerald-700 text-white')}>
        <Plus className="h-4 w-4" /> Create Client
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" {...register('first_name')} />
              {errors.first_name && <p className="text-sm text-red-500">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name (Optional)</Label>
              <Input id="last_name" {...register('last_name')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Optional)</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Client Type</Label>
              <Select value={currentType} onValueChange={(val: any) => setValue('type', val)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name (Optional)</Label>
              <Input id="company_name" {...register('company_name')} disabled={currentType !== 'commercial'} />
            </div>
          </div>

          <hr className="border-slate-200" />
          <h3 className="font-semibold text-slate-700">Initial Lead Details (Optional)</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stage">Initial Status</Label>
              <Select value={currentStage} onValueChange={(val: any) => setValue('stage', val)}>
                <SelectTrigger id="stage">
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inquiry">Inquiry (New)</SelectItem>
                  <SelectItem value="quote_sent">Quote Sent</SelectItem>
                  <SelectItem value="survey_scheduled">Survey Scheduled</SelectItem>
                  <SelectItem value="follow_up">Follow Up</SelectItem>
                  <SelectItem value="confirmed_booking">Booked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Lost / No Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="preferred_move_date">Move Date</Label>
              <Input id="preferred_move_date" type="date" {...register('preferred_move_date')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="estimated_hours">Est. Hours</Label>
              <Input id="estimated_hours" type="number" step="0.5" {...register('estimated_hours', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated_crew_size">Est. Crew Size (Men)</Label>
              <Input id="estimated_crew_size" type="number" {...register('estimated_crew_size', { valueAsNumber: true })} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pickup Location (Optional)</Label>
              <div className="flex gap-2">
                <Input placeholder="City" {...register('origin_city')} />
                <Input placeholder="Postcode" className="w-28" {...register('origin_postcode')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Delivery Location (Optional)</Label>
              <div className="flex gap-2">
                <Input placeholder="City" {...register('destination_city')} />
                <Input placeholder="Postcode" className="w-28" {...register('destination_postcode')} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quote_amount">Quoted Amount (£) (Optional)</Label>
              <Input id="quote_amount" type="number" step="0.01" {...register('quote_amount', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register('notes')} placeholder="Any initial notes about the client or move..." />
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
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Saving...' : 'Save Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
