'use client'

import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { pricingSettingsSchema, PricingSettingsInput } from '@/modules/settings/pricing/schemas'
import { updatePricingAction } from '../actions'
import { X, Plus } from 'lucide-react'

interface Props {
  settings: any
}

export function PricingForm({ settings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PricingSettingsInput>({
    resolver: zodResolver(pricingSettingsSchema),
    defaultValues: {
      base_rate: settings?.base_rate || 0,
      per_mile_rate: settings?.per_mile_rate || 0,
      per_cubic_foot_rate: settings?.per_cubic_foot_rate || 0,
      labor_hourly_rate: settings?.labor_hourly_rate || 0,
      labour_hours_per_cubicft: settings?.labour_hours_per_cubicft || 0.1,
      surcharges: settings?.surcharges || [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'surcharges',
  })

  const onSubmit = (data: PricingSettingsInput) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        formData.append('base_rate', String(data.base_rate))
        formData.append('per_mile_rate', String(data.per_mile_rate))
        formData.append('per_cubic_foot_rate', String(data.per_cubic_foot_rate))
        formData.append('labor_hourly_rate', String(data.labor_hourly_rate))
        formData.append('labour_hours_per_cubicft', String(data.labour_hours_per_cubicft))
        formData.append('surcharges', JSON.stringify(data.surcharges))

        await updatePricingAction(formData)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update pricing')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-8">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          Pricing settings updated successfully
        </div>
      )}

      {/* Warning about existing quotes */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded">
        <p className="text-sm text-amber-900">
          <strong>Note:</strong> Changing these rates does not affect quotes already created —
          every quote snapshots its pricing at creation time.
        </p>
      </div>

      {/* Rate Fields */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Base Rates</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Base Rate (£)</label>
            <input
              type="number"
              step="0.01"
              {...register('base_rate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {errors.base_rate && (
              <p className="text-sm text-red-600 mt-1">{errors.base_rate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Per-Mile Rate (£)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('per_mile_rate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {errors.per_mile_rate && (
              <p className="text-sm text-red-600 mt-1">{errors.per_mile_rate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Per Cubic Foot Rate (£)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('per_cubic_foot_rate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {errors.per_cubic_foot_rate && (
              <p className="text-sm text-red-600 mt-1">{errors.per_cubic_foot_rate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Labor Hourly Rate (£)
            </label>
            <input
              type="number"
              step="0.01"
              {...register('labor_hourly_rate', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {errors.labor_hourly_rate && (
              <p className="text-sm text-red-600 mt-1">{errors.labor_hourly_rate.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Labor Hours per Cubic Foot
            </label>
            <input
              type="number"
              step="0.01"
              {...register('labour_hours_per_cubicft', { valueAsNumber: true })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            {errors.labour_hours_per_cubicft && (
              <p className="text-sm text-red-600 mt-1">{errors.labour_hours_per_cubicft.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Surcharges */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">Surcharges</h3>
          <button
            type="button"
            onClick={() => append({ key: '', label: '', amount: 0, type: 'fixed' })}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors"
          >
            <Plus size={16} />
            Add Surcharge
          </button>
        </div>

        {fields.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No surcharges configured yet.</p>
        ) : (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-4 gap-2 items-end p-3 bg-slate-50 rounded">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Key</label>
                  <input
                    {...register(`surcharges.${index}.key`)}
                    placeholder="e.g., stairs"
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Label</label>
                  <input
                    {...register(`surcharges.${index}.label`)}
                    placeholder="e.g., Stairs"
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Amount (£)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register(`surcharges.${index}.amount`, { valueAsNumber: true })}
                    className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Saving...' : 'Save Pricing Settings'}
      </button>
    </form>
  )
}
