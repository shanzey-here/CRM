'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, Loader2 } from 'lucide-react'
import { announcementFormSchema, AnnouncementFormInput } from '@/modules/announcements/schemas'
import { createAnnouncementAction, updateAnnouncementAction } from '../actions'
import { AnnouncementRecord } from '@/modules/announcements/matching'

type TenantOption = { id: string; name: string }
type PlanOption = { id: string; name: string }

interface Props {
  tenants: TenantOption[]
  plans: PlanOption[]
  existing?: AnnouncementRecord
  trigger?: React.ReactNode
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" (no seconds/timezone); this
// converts a stored ISO timestamp back into that shape for editing.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function AnnouncementDialog({ tenants, plans, existing, trigger }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AnnouncementFormInput>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: existing
      ? {
          title: existing.title,
          body: existing.body,
          severity: existing.severity,
          target_type: existing.target_type,
          target_ids: existing.target_ids,
          dismissible: existing.dismissible,
          starts_at: toDatetimeLocal(existing.starts_at),
          ends_at: toDatetimeLocal(existing.ends_at),
        }
      : {
          title: '',
          body: '',
          severity: 'info',
          target_type: 'all_tenants',
          target_ids: [],
          dismissible: true,
          starts_at: '',
          ends_at: '',
        },
  })

  const targetType = watch('target_type')

  function close() {
    setIsOpen(false)
    setError(null)
    reset()
  }

  const onSubmit = (data: AnnouncementFormInput) => {
    startTransition(async () => {
      setError(null)
      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('body', data.body)
      formData.append('severity', data.severity)
      formData.append('target_type', data.target_type)
      data.target_ids.forEach((id) => formData.append('target_ids', id))
      formData.append('dismissible', data.dismissible ? 'true' : 'false')
      formData.append('starts_at', data.starts_at ? new Date(data.starts_at).toISOString() : '')
      formData.append('ends_at', data.ends_at ? new Date(data.ends_at).toISOString() : '')

      const result = existing
        ? await updateAnnouncementAction(existing.id, formData)
        : await createAnnouncementAction(formData)

      if (result?.error) {
        setError(result.error)
      } else {
        close()
      }
    })
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setIsOpen(true)}>{trigger}</span>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
        >
          <Plus size={18} />
          New Announcement
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
              <h2 className="text-lg font-semibold text-slate-900">
                {existing ? 'Edit Announcement' : 'New Announcement'}
              </h2>
              <button onClick={close} className="text-slate-400 hover:text-slate-900 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Title</label>
                <input
                  type="text"
                  {...register('title')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
                {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Body</label>
                <textarea
                  {...register('body')}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
                {errors.body && <p className="text-xs text-red-600 mt-1">{errors.body.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Severity</label>
                  <select
                    {...register('severity')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Target</label>
                  <select
                    {...register('target_type')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="all_tenants">All Tenants</option>
                    <option value="specific_tenants">Specific Tenants</option>
                    <option value="by_plan">By Plan</option>
                  </select>
                </div>
              </div>

              {targetType === 'specific_tenants' && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Tenants</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {tenants.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" value={t.id} {...register('target_ids')} />
                        {t.name}
                      </label>
                    ))}
                  </div>
                  {errors.target_ids && <p className="text-xs text-red-600 mt-1">{errors.target_ids.message}</p>}
                </div>
              )}

              {targetType === 'by_plan' && (
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Plans</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {plans.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer">
                        <input type="checkbox" value={p.id} {...register('target_ids')} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                  {errors.target_ids && <p className="text-xs text-red-600 mt-1">{errors.target_ids.message}</p>}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Starts At (optional)</label>
                  <input
                    type="datetime-local"
                    {...register('starts_at')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Ends At (optional)</label>
                  <input
                    type="datetime-local"
                    {...register('ends_at')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  {errors.ends_at && <p className="text-xs text-red-600 mt-1">{errors.ends_at.message}</p>}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-900">
                <input type="checkbox" {...register('dismissible')} />
                Dismissible by the tenant admin
              </label>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={close} className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {existing ? 'Save Changes' : 'Create Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
