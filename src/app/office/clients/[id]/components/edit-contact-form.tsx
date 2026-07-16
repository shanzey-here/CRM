'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateContactSchema, UpdateContactInput } from '@/modules/clients/schemas'
import { Contact } from '@/modules/clients/server/repository'
import { updateContactAction } from '../../actions'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Edit2 } from 'lucide-react'

export function EditContactForm({ contact }: { contact: Contact }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateContactInput>({
    resolver: zodResolver(updateContactSchema),
    defaultValues: {
      first_name: contact.first_name,
      last_name: contact.last_name || '',
      company_name: contact.company_name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      alt_phone: contact.alt_phone || '',
      type: contact.type as 'residential' | 'commercial',
      notes: contact.notes || ''
    }
  })

  // We need to explicitly watch type for the Select component
  const typeValue = watch('type')

  const onSubmit = async (data: UpdateContactInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)
    
    const result = await updateContactAction(contact.id, data)
    
    setIsSubmitting(false)
    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* @ts-expect-error Radix UI type mismatch with React 19 */}
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Edit2 className="h-4 w-4" /> Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Customer Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name <span className="text-red-500">*</span></Label>
              <Input id="first_name" {...register('first_name')} className={errors.first_name ? 'border-red-500' : ''} />
              {errors.first_name && <p className="text-sm text-red-500">{errors.first_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" {...register('last_name')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} className={errors.email ? 'border-red-500' : ''} />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Primary Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input id="company_name" {...register('company_name')} />
            </div>
            <div className="space-y-2">
              <Label>Client Type</Label>
              <Select 
                value={typeValue} 
                onValueChange={(val: 'residential' | 'commercial') => setValue('type', val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" {...register('notes')} placeholder="Internal notes about this client..." />
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
