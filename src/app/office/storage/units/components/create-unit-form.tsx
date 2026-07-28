'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createStorageUnitSchema } from '@/modules/storage/schemas'
import { createStorageUnitAction } from '../../actions'

export function CreateUnitForm() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createStorageUnitSchema),
    defaultValues: { unitNumber: '', capacityCubicFeet: 0, locationNotes: '' },
  })

  const onSubmit = (data: { unitNumber: string; capacityCubicFeet: number; locationNotes?: string }) => {
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('unitNumber', data.unitNumber)
      formData.append('capacityCubicFeet', String(data.capacityCubicFeet))
      if (data.locationNotes) formData.append('locationNotes', data.locationNotes)

      const result = await createStorageUnitAction(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      reset()
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 rounded-lg border border-slate-200 bg-white mb-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Add a storage unit</h2>
      {error && <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
      {success && <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-sm">Storage unit created</div>}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
        <div>
          <input
            type="text"
            placeholder="Unit number (e.g. A-101)"
            {...register('unitNumber')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {errors.unitNumber && <p className="text-xs text-red-600 mt-1">{errors.unitNumber.message}</p>}
        </div>
        <div>
          <input
            type="number"
            step="any"
            placeholder="Capacity (cubic ft)"
            {...register('capacityCubicFeet')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          {errors.capacityCubicFeet && <p className="text-xs text-red-600 mt-1">{errors.capacityCubicFeet.message}</p>}
        </div>
        <div>
          <input
            type="text"
            placeholder="Location notes (optional)"
            {...register('locationNotes')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? 'Adding...' : 'Add unit'}
        </button>
      </div>
    </form>
  )
}
