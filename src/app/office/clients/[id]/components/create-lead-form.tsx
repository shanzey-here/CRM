'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { insertLeadSchema, InsertLeadInput } from '@/modules/leads/schemas'
import { createLeadAction } from '../../../leads/actions'

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
import { Loader2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CreateLeadForm({ contactId, brands }: { contactId: string; brands: { id: string; name: string; is_default: boolean }[] }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const defaultBrandId = brands.find((b) => b.is_default)?.id ?? brands[0]?.id

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<InsertLeadInput>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      contact_id: contactId,
      brand_id: defaultBrandId,
      stage: 'inquiry',
      source: 'phone_inquiry',
      notes: '',
      preferred_move_date: '',
    },
  })

  const currentSource = watch('source')

  const onSubmit = async (data: InsertLeadInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)

    const result = await createLeadAction(data)

    setIsSubmitting(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to create lead')
    } else {
      reset()
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'gap-2 bg-emerald-600 hover:bg-emerald-700 text-white')}>
        <Plus className="h-4 w-4" /> Create Lead
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          {brands.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="brand_id">Brand</Label>
              <Select
                defaultValue={defaultBrandId}
                onValueChange={(val) => setValue('brand_id', val)}
              >
                <SelectTrigger id="brand_id">
                  <SelectValue placeholder="Select brand">
                    {(val: string) => {
                      const b = brands.find((br) => br.id === val)
                      return b ? b.name + (b.is_default ? ' (Default)' : '') : 'Select brand'
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}{b.is_default ? ' (Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="source">Source (How did this lead originate?)</Label>
            <Select 
              value={currentSource || ''} 
              onValueChange={(val) => setValue('source', val)}
            >
              <SelectTrigger id="source">
                <SelectValue placeholder="Select a source..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone_inquiry">Phone Inquiry (Customer Called)</SelectItem>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="referral">Referral (Existing Customer)</SelectItem>
                <SelectItem value="returning_customer">Returning Customer</SelectItem>
                <SelectItem value="cold_outreach">Proactive Outreach (We Called)</SelectItem>
                <SelectItem value="b2b_referral">B2B Partner Referral (Estate Agent, etc.)</SelectItem>
                <SelectItem value="website_form">Website Form</SelectItem>
                <SelectItem value="compare_my_move">Compare My Move</SelectItem>
                <SelectItem value="reallymoving">Reallymoving</SelectItem>
                <SelectItem value="bark">Bark</SelectItem>
                <SelectItem value="social_media">Social Media (FB, Insta)</SelectItem>
                <SelectItem value="manual">Other / Manual</SelectItem>
              </SelectContent>
            </Select>
            {errors.source && <p className="text-sm text-red-500">{errors.source.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="preferred_move_date">Preferred Move Date (Optional)</Label>
              <Input id="preferred_move_date" type="date" {...register('preferred_move_date')} />
              {errors.preferred_move_date && (
                <p className="text-sm text-red-500">{errors.preferred_move_date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="estimated_volume">Est. Volume (m³) (Optional)</Label>
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
            <Label htmlFor="notes">Initial Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Context about this inquiry..."
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
              Create Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
