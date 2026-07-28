'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createCrateSchema, CreateCrateInput } from '@/modules/storage/schemas'
import { createCrateAction } from '../../../actions'

type Unit = { id: string; unit_number: string }

export function CrateForm({ units }: { units: Unit[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCrateInput>({
    resolver: zodResolver(createCrateSchema),
    defaultValues: { crateNumber: '', storageUnitId: undefined },
  })

  const onSubmit = (data: CreateCrateInput) => {
    setError(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('crateNumber', data.crateNumber)
      if (data.storageUnitId) formData.append('storageUnitId', data.storageUnitId)

      const result = await createCrateAction(formData)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.push(`/office/storage/crates/${result.data!.id}`)
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 rounded-lg border border-slate-200 bg-white space-y-4">
      {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

      <div>
        <label className="block text-sm font-medium text-slate-900 mb-1">Crate number</label>
        <input
          type="text"
          placeholder="e.g. CRATE-0042"
          {...register('crateNumber')}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        {errors.crateNumber && <p className="text-xs text-red-600 mt-1">{errors.crateNumber.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-900 mb-1">Initial storage unit (optional)</label>
        <select {...register('storageUnitId')} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">Unassigned</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unit_number}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-slate-500">New crates always start as "In Warehouse".</p>

      <button
        type="submit"
        disabled={isPending}
        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
      >
        {isPending ? 'Creating...' : 'Create crate'}
      </button>
    </form>
  )
}
