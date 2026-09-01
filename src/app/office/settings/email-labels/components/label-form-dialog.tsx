'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, Loader2 } from 'lucide-react'
import { emailLabelSchema, EmailLabelInput } from '@/modules/email-labels/schemas'
import { createLabelAction, updateLabelAction } from '../actions'
import { getContrastTextColor } from '@/modules/email-labels/color'

type ExistingLabel = { id: string; name: string; color_hex: string; is_default: boolean }

interface Props {
  existingLabels: ExistingLabel[]
  editing?: ExistingLabel
  trigger?: React.ReactNode
}

export function LabelFormDialog({ existingLabels, editing, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<EmailLabelInput>({
    resolver: zodResolver(emailLabelSchema),
    defaultValues: editing
      ? { name: editing.name, color_hex: editing.color_hex }
      : { name: '', color_hex: '#3B82F6' },
  })

  const colorHex = watch('color_hex')

  function close() {
    setIsOpen(false)
    setError(null)
    reset()
  }

  const onSubmit = (data: EmailLabelInput) => {
    startTransition(async () => {
      setError(null)
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('color_hex', data.color_hex)

      const result = editing ? await updateLabelAction(editing.id, formData) : await createLabelAction(formData)

      if (result.error) setError(result.error)
      else close()
    })
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setIsOpen(true)}>{trigger}</span>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm text-sm"
        >
          <Plus size={16} />
          New Label
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Edit Label' : 'New Label'}</h2>
              <button
                onClick={close}
                className="text-slate-400 hover:text-slate-900 transition-colors"
                title="Close dialog"
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Name</label>
                <input
                  type="text"
                  {...register('name')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
                {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" {...register('color_hex')} className="h-10 w-20 border border-slate-300 rounded cursor-pointer" />
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ backgroundColor: colorHex, color: getContrastTextColor(colorHex || '#ffffff') }}
                  >
                    {watch('name') || 'Preview'}
                  </span>
                </div>
                {errors.color_hex && <p className="text-xs text-red-600 mt-1">{errors.color_hex.message}</p>}
              </div>

              {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={close} className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm text-sm"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {editing ? 'Save Changes' : 'Create Label'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
