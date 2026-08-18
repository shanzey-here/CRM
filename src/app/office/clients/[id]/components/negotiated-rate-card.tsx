'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { contactPricingOverrideSchema, ContactPricingOverrideInput } from '@/modules/clients/schemas'
import { ContactPricingOverride } from '@/modules/clients/server/pricing-overrides'
import { setContactPricingOverrideAction, deactivateContactPricingOverrideAction } from '../../actions'

import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NegotiatedRateCard({ contactId, override }: { contactId: string; override: ContactPricingOverride | null }) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactPricingOverrideInput>({
    resolver: zodResolver(contactPricingOverrideSchema),
    defaultValues: {
      discount_percent: override?.discount_percent ?? undefined,
      notes: override?.notes ?? '',
    },
  })

  const onSubmit = async (data: ContactPricingOverrideInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)
    const result = await setContactPricingOverrideAction(contactId, data)
    setIsSubmitting(false)
    if (result.error) {
      setErrorMsg(result.error)
    } else {
      setOpen(false)
    }
  }

  const onDeactivate = async () => {
    setIsSubmitting(true)
    setErrorMsg(null)
    const result = await deactivateContactPricingOverrideAction(contactId)
    setIsSubmitting(false)
    if (result.error) {
      setErrorMsg(result.error)
    }
  }

  const isActive = override?.is_active === true

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Negotiated Rate</CardTitle>
          <CardDescription>Manual, tenant_admin-only pricing override for this contact</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2')}>
            <Percent className="h-4 w-4" /> {isActive ? 'Edit Rate' : 'Set Rate'}
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>{isActive ? 'Edit Negotiated Rate' : 'Set Negotiated Rate'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="discount_percent">Discount Percentage <span className="text-red-500">*</span></Label>
                <Input
                  id="discount_percent"
                  type="number"
                  step="0.01"
                  {...register('discount_percent')}
                  className={errors.discount_percent ? 'border-red-500' : ''}
                  placeholder="e.g. 15"
                />
                {errors.discount_percent && <p className="text-sm text-red-500">{errors.discount_percent.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" {...register('notes')} placeholder="What was negotiated and why..." />
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
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {!override ? (
          <div className="text-center py-6 text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-lg">
            No negotiated rate on file for this contact.
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                  {isActive ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-lg font-bold text-slate-900">{Number(override.discount_percent).toFixed(2)}% off</span>
              </div>
              {override.notes && <p className="text-sm text-slate-600 mt-1">{override.notes}</p>}
              <p className="text-xs text-slate-400 mt-1">
                Last updated {new Date(override.updated_at || override.created_at).toLocaleDateString()}
              </p>
            </div>
            {isActive && (
              <Button variant="outline" size="sm" onClick={onDeactivate} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Deactivate
              </Button>
            )}
          </div>
        )}
        {errorMsg && !open && (
          <div className="p-3 text-sm bg-red-50 border border-red-200 text-red-600 rounded-md">
            {errorMsg}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
