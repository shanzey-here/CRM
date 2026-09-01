'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { updateDraftInvoiceSchema, UpdateDraftInvoiceInput } from '@/modules/invoicing/schema'
import { updateDraftInvoiceAction } from '../../actions'

import { Button, buttonVariants } from '@/components/ui/button'
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
import { Loader2, Edit2, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditDraftInvoiceFormProps {
  invoiceId: string
  notes: string | null
  lineItems: Array<{ description: string; quantity: number; unit_price: number; sort_order: number }>
}

export function EditDraftInvoiceForm({ invoiceId, notes, lineItems }: EditDraftInvoiceFormProps) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<UpdateDraftInvoiceInput>({
    resolver: zodResolver(updateDraftInvoiceSchema),
    defaultValues: {
      notes: notes || '',
      lineItems: lineItems.length > 0
        ? lineItems.map((li, i) => ({ ...li, sort_order: li.sort_order ?? i }))
        : [{ description: '', quantity: 1, unit_price: 0, sort_order: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const watchedItems = watch('lineItems')
  const liveTotal = (watchedItems || []).reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0),
    0
  )

  const onSubmit = async (data: UpdateDraftInvoiceInput) => {
    setIsSubmitting(true)
    setErrorMsg(null)

    const result = await updateDraftInvoiceAction(invoiceId, {
      ...data,
      lineItems: data.lineItems.map((li, i) => ({ ...li, sort_order: i })),
    })

    setIsSubmitting(false)
    if (!result.success) {
      setErrorMsg(result.error || 'Failed to update invoice')
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
        <Edit2 className="h-4 w-4" /> Edit Invoice
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Draft Invoice</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="space-y-3">
            <Label>Line Items</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  <Input
                    {...register(`lineItems.${index}.description`)}
                    placeholder="Description"
                  />
                  {errors.lineItems?.[index]?.description && (
                    <p className="text-xs text-red-500 mt-1">{errors.lineItems[index]?.description?.message}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                    placeholder="Qty"
                  />
                  {errors.lineItems?.[index]?.quantity && (
                    <p className="text-xs text-red-500 mt-1">{errors.lineItems[index]?.quantity?.message}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`lineItems.${index}.unit_price`, { valueAsNumber: true })}
                    placeholder="Unit £"
                  />
                  {errors.lineItems?.[index]?.unit_price && (
                    <p className="text-xs text-red-500 mt-1">{errors.lineItems[index]?.unit_price?.message}</p>
                  )}
                </div>
                <div className="col-span-2 pt-2 text-sm text-right text-slate-600 font-medium">
                  £{((Number(watchedItems?.[index]?.quantity) || 0) * (Number(watchedItems?.[index]?.unit_price) || 0)).toFixed(2)}
                </div>
                <div className="col-span-1 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    title="Remove line item"
                    aria-label="Remove line item"
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
              </div>
            ))}
            {errors.lineItems?.message && <p className="text-xs text-red-500">{errors.lineItems.message}</p>}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, sort_order: fields.length })}
              className="gap-2"
            >
              <Plus className="h-4 w-4" /> Add Line Item
            </Button>
          </div>

          <div className="flex justify-end items-center gap-3 pt-2 border-t border-slate-100">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-lg font-bold text-slate-900">£{liveTotal.toFixed(2)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Invoice notes / terms..."
              className="min-h-20"
            />
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
