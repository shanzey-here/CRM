'use client'

import { useState, useTransition } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createManualJobAction } from '../actions'
import { CreateManualJobSchema, CreateManualJobData } from '@/modules/jobs/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TenantUser } from '@/modules/users/server/repository'
import { Vehicle } from '@/modules/vehicles/server/repository'
import { Contact } from '@/modules/clients/schemas'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'

interface ManualJobFormProps {
  contacts: Contact[]
  tenantStaff: TenantUser[]
  vehicles: Vehicle[]
  brands: { id: string; name: string; is_default: boolean }[]
  initialSlot?: { date: Date, hour?: number } | null
  onSuccess?: (jobId: string) => void
}

export function ManualJobForm({ contacts, tenantStaff, vehicles, brands, initialSlot, onSuccess }: ManualJobFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const defaultDate = initialSlot 
    ? initialSlot.date.toISOString().split('T')[0]
    : ''

  const defaultStartTime = initialSlot && initialSlot.hour !== undefined 
    ? new Date(initialSlot.date.setHours(initialSlot.hour, 0, 0, 0)).toISOString()
    : undefined
    
  const defaultEndTime = initialSlot && initialSlot.hour !== undefined
    ? new Date(initialSlot.date.setHours(initialSlot.hour + 2, 0, 0, 0)).toISOString()
    : undefined

  const defaultBrandId = brands.find((b) => b.is_default)?.id ?? brands[0]?.id

  const { register, control, handleSubmit, setValue, watch, formState: { errors, isValid }, reset } = useForm<CreateManualJobData>({
    resolver: zodResolver(CreateManualJobSchema),
    defaultValues: {
      brand_id: defaultBrandId,
      move_date: defaultDate,
      start_time: defaultStartTime,
      end_time: defaultEndTime,
      assigned_crew: [],
      assigned_vehicles: [],
      line_items: [{ description: '', quantity: 1, unit_price: 0 }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "line_items"
  })

  const onSubmit = (data: CreateManualJobData) => {
    startTransition(async () => {
      setServerError(null)
      const res = await createManualJobAction(data)

      if (res.success && res.jobId) {
        reset()
        if (onSuccess) {
          onSuccess(res.jobId)
        } else {
          router.push(`/office/jobs/${res.jobId}`)
        }
      } else {
        if (res.error === 'DOUBLE_BOOKING_CONFLICT') {
          setServerError('Conflict: ' + res.details)
        } else {
          setServerError(res.error || 'Failed to create job')
        }
      }
    })
  }

  const handleCrewChange = (userId: string) => {
    const current = watch('assigned_crew')
    if (current.includes(userId)) {
      setValue('assigned_crew', current.filter(id => id !== userId))
    } else {
      setValue('assigned_crew', [...current, userId])
    }
  }

  const handleVehicleChange = (vehicleId: string) => {
    const current = watch('assigned_vehicles')
    if (current.includes(vehicleId)) {
      setValue('assigned_vehicles', current.filter(id => id !== vehicleId))
    } else {
      setValue('assigned_vehicles', [...current, vehicleId])
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-white p-4 rounded-lg border border-slate-200 text-left">
      <div className="space-y-2">
        <Label htmlFor="contact_id">Client</Label>
        <Select 
          disabled={isPending} 
          onValueChange={(val) => setValue('contact_id', val)}
        >
          <SelectTrigger id="contact_id">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {contacts.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.first_name} {c.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.contact_id && <p className="text-sm text-red-500">{errors.contact_id.message}</p>}
      </div>

      {brands.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="brand_id">Brand</Label>
          <Select
            disabled={isPending}
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Job Title</Label>
          <Input id="title" {...register('title')} disabled={isPending} placeholder="e.g. Local Move" />
          {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="move_date">Move Date</Label>
          <Input id="move_date" type="date" {...register('move_date')} disabled={isPending} />
          {errors.move_date && <p className="text-sm text-red-500">{errors.move_date.message}</p>}
        </div>
      </div>

      {/* Dynamic Line Items */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <Label className="font-semibold text-slate-800">Invoice Line Items</Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={() => append({ description: '', quantity: 1, unit_price: 0 })}
            disabled={isPending}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>
        
        {fields.map((field, index) => (
          <div key={field.id} className="flex space-x-2 items-start mb-2">
            <div className="flex-1 space-y-1">
              <Input 
                placeholder="Description" 
                {...register(`line_items.${index}.description`)} 
                disabled={isPending} 
              />
              {errors.line_items?.[index]?.description && (
                <p className="text-xs text-red-500">{errors.line_items[index]?.description?.message}</p>
              )}
            </div>
            <div className="w-24 space-y-1">
              <Input 
                type="number" 
                step="1" 
                placeholder="Qty" 
                {...register(`line_items.${index}.quantity`, { valueAsNumber: true })} 
                disabled={isPending} 
              />
              {errors.line_items?.[index]?.quantity && (
                <p className="text-xs text-red-500">{errors.line_items[index]?.quantity?.message}</p>
              )}
            </div>
            <div className="w-32 space-y-1">
              <Input 
                type="number" 
                step="0.01" 
                placeholder="Price" 
                {...register(`line_items.${index}.unit_price`, { valueAsNumber: true })} 
                disabled={isPending} 
              />
              {errors.line_items?.[index]?.unit_price && (
                <p className="text-xs text-red-500">{errors.line_items[index]?.unit_price?.message}</p>
              )}
            </div>
            <Button 
              type="button" 
              variant="ghost" 
              className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2"
              onClick={() => remove(index)}
              disabled={isPending || fields.length === 1}
              title="Remove line item"
              aria-label="Remove line item"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-4">
        <Label className="font-semibold text-slate-800">Assignments</Label>
        <div className="text-xs text-slate-500 mb-2">Requires Start and End times to enforce double-booking prevention.</div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="start_time">Start Time</Label>
            <Input id="start_time" type="datetime-local" {...register('start_time')} disabled={isPending} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_time">End Time</Label>
            <Input id="end_time" type="datetime-local" {...register('end_time')} disabled={isPending} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs mb-1 block">Crew</Label>
            <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-slate-50">
              {tenantStaff.map(staff => (
                <label key={staff.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={watch('assigned_crew').includes(staff.id)} onChange={() => handleCrewChange(staff.id)} disabled={isPending} className="rounded border-slate-300" />
                  <span>{staff.full_name || staff.email}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Vehicles</Label>
            <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-slate-50">
              {vehicles.map(vehicle => (
                <label key={vehicle.id} className="flex items-center space-x-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={watch('assigned_vehicles').includes(vehicle.id)} onChange={() => handleVehicleChange(vehicle.id)} disabled={isPending} className="rounded border-slate-300" />
                  <span>{vehicle.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {serverError && <p className="text-sm font-semibold text-red-600 bg-red-50 p-3 rounded">{serverError}</p>}
      
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isPending || !isValid}>
          {isPending ? 'Creating...' : 'Create Job'}
        </Button>
      </div>
    </form>
  )
}
