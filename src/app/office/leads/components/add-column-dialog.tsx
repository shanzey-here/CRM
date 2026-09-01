'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, Loader2, Palette } from 'lucide-react'
import { createCustomStageSchema, type CreateCustomStageInput, type PipelineStageDef } from '@/modules/leads/schemas'
import { createCustomColumnAction } from '../actions'

const PRESET_COLORS = [
  { label: 'Slate', value: '#64748b' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Violet', value: '#8b5cf6' },
]

interface AddColumnDialogProps {
  isOpen: boolean
  onClose: () => void
  onColumnCreated?: (stage: PipelineStageDef) => void
}

export function AddColumnDialog({ isOpen, onClose, onColumnCreated }: AddColumnDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateCustomStageInput>({
    resolver: zodResolver(createCustomStageSchema),
    defaultValues: {
      name: '',
      color: '#64748b',
    },
  })

  const selectedColor = watch('color') || '#64748b'

  if (!isOpen) return null

  function handleClose() {
    setServerError(null)
    reset()
    onClose()
  }

  const onSubmit = (data: CreateCustomStageInput) => {
    setServerError(null)
    startTransition(async () => {
      const result = await createCustomColumnAction(data)
      if (!result.success) {
        setServerError(result.error)
        return
      }

      reset()
      onColumnCreated?.(result.data)
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
      data-testid="add-column-dialog-backdrop"
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-column-dialog-title"
        data-testid="add-column-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full transition-colors"
              style={{ backgroundColor: selectedColor }}
            />
            <h2 id="add-column-dialog-title" className="text-base font-semibold text-slate-900">
              Add Pipeline Column
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {serverError && (
            <div
              role="alert"
              className="p-3 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700"
              data-testid="add-column-error"
            >
              {serverError}
            </div>
          )}

          {/* Name Field */}
          <div>
            <label htmlFor="stage-name-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Column Name <span className="text-red-500">*</span>
            </label>
            <input
              id="stage-name-input"
              type="text"
              placeholder="e.g. Needs Survey, Decision Pending"
              autoFocus
              {...register('name')}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              data-testid="add-column-name-input"
            />
            {errors.name && (
              <p className="text-xs text-red-600 mt-1 font-medium" data-testid="add-column-name-error">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Header Indicator Color</span>
              <span className="font-mono text-[11px] text-slate-400 uppercase">{selectedColor}</span>
            </label>

            {/* Preset Color Swatches */}
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((preset) => {
                const isSelected = selectedColor.toLowerCase() === preset.value.toLowerCase()
                return (
                  <button
                    key={preset.value}
                    type="button"
                    title={`Select color ${preset.label}`}
                    aria-label={`Select color ${preset.label}`}
                    onClick={() => setValue('color', preset.value, { shouldValidate: true })}
                    className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                      isSelected ? 'ring-2 ring-offset-2 ring-blue-600 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.value }}
                    data-testid={`color-preset-${preset.label.toLowerCase()}`}
                  />
                )
              })}
            </div>

            {/* Custom Hex Picker */}
            <div className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="color"
                {...register('color')}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
                data-testid="add-column-color-picker"
              />
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                Custom color
              </span>
            </div>
            {errors.color && (
              <p className="text-xs text-red-600 mt-1 font-medium">{errors.color.message}</p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="add-column-submit-button"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Create Column
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

