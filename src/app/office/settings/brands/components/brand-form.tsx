'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { brandFormSchema, BrandFormInput } from '@/modules/settings/brands/schemas'
import { createBrandAction, updateBrandAction } from '../actions'
import { Brand } from '@/modules/settings/brands/server/repository'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
import { Loader2, Plus, Pencil } from 'lucide-react'

function toDefaults(brand?: Brand | null): BrandFormInput {
  return {
    name: brand?.name || '',
    logo_url: brand?.logo_url || '',
    email: brand?.email || '',
    phone: brand?.phone || '',
    address_line_1: brand?.address_line_1 || '',
    address_line_2: brand?.address_line_2 || '',
    address_city: brand?.address_city || '',
    address_county: brand?.address_county || '',
    address_postcode: brand?.address_postcode || '',
    address_country: brand?.address_country || 'GB',
    vat_number: brand?.vat_number || '',
    bank_details: brand?.bank_details || '',
    terms_text: brand?.terms_text || '',
  }
}

export function BrandForm({ brand }: { brand?: Brand }) {
  const isEdit = !!brand
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BrandFormInput>({
    resolver: zodResolver(brandFormSchema),
    defaultValues: toDefaults(brand),
  })

  const onSubmit = (data: BrandFormInput) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        Object.entries(data).forEach(([key, value]) => formData.append(key, value || ''))
        if (isEdit) {
          await updateBrandAction(brand!.id, formData)
        } else {
          await createBrandAction(formData)
        }
        setOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save brand')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEdit ? (
        <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </DialogTrigger>
      ) : (
        <DialogTrigger className={cn(buttonVariants({ variant: 'default' }), 'gap-1.5')}>
          <Plus className="h-4 w-4" /> Add Brand
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${brand!.name}` : 'Add a New Brand'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Brand Name</Label>
            <Input id="name" {...register('name')} placeholder="e.g. Advantage Removals" />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" {...register('email')} placeholder="hello@brand.co.uk" />
              {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} placeholder="+44 20 3667 2740" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input id="logo_url" {...register('logo_url')} placeholder="https://.../logo.png" />
            {errors.logo_url && <p className="text-sm text-red-500">{errors.logo_url.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address_line_1">Address Line 1</Label>
              <Input id="address_line_1" {...register('address_line_1')} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="address_line_2">Address Line 2</Label>
              <Input id="address_line_2" {...register('address_line_2')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_city">City</Label>
              <Input id="address_city" {...register('address_city')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_county">County</Label>
              <Input id="address_county" {...register('address_county')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_postcode">Postcode</Label>
              <Input id="address_postcode" {...register('address_postcode')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_country">Country</Label>
              <Input id="address_country" {...register('address_country')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vat_number">VAT Number</Label>
            <Input id="vat_number" {...register('vat_number')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bank_details">Bank Details (shown on Payment Instructions block)</Label>
            <Textarea id="bank_details" {...register('bank_details')} className="min-h-20" placeholder={'Barclays 20-38-83\nA/C: 43279928'} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="terms_text">Terms Text</Label>
            <Textarea id="terms_text" {...register('terms_text')} className="min-h-24" />
          </div>

          {error && (
            <div className="p-3 text-sm bg-red-50 border border-red-200 text-red-600 rounded-md">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Brand'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
