'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2, Lock } from 'lucide-react'
import { getContrastTextColor } from '@/modules/email-labels/color'
import { deleteLabelAction, getLabelUsageCountAction } from '../actions'
import { LabelFormDialog } from './label-form-dialog'

type Label = { id: string; name: string; color_hex: string; is_default: boolean }

export function LabelList({ labels }: { labels: Label[] }) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(label: Label) {
    setError(null)
    setPendingId(label.id)

    const { count, error: countError } = await getLabelUsageCountAction(label.id)
    if (countError) {
      setError(countError)
      setPendingId(null)
      return
    }

    const message =
      count > 0
        ? `"${label.name}" is used on ${count} thread${count === 1 ? '' : 's'} — deleting will remove it from all of them. Continue?`
        : `Delete "${label.name}"? It isn't used on any threads.`

    if (!confirm(message)) {
      setPendingId(null)
      return
    }

    startTransition(async () => {
      const result = await deleteLabelAction(label.id)
      if (result.error) setError(result.error)
      setPendingId(null)
    })
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {error && <div className="p-3 bg-red-50 border-b border-red-200 text-red-700 text-sm">{error}</div>}
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Label</th>
            <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
            <th className="text-right px-4 py-3 font-medium text-slate-500">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {labels.map((label) => (
            <tr key={label.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-3">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: label.color_hex, color: getContrastTextColor(label.color_hex) }}
                >
                  {label.name}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {label.is_default ? (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Lock size={12} /> Default
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Custom</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <LabelFormDialog
                    existingLabels={labels}
                    editing={label}
                    trigger={
                      <button
                        className="p-1.5 text-slate-400 hover:text-[var(--color-primary)] transition-colors"
                        title={`Edit label: ${label.name}`}
                        aria-label={`Edit label: ${label.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                    }
                  />
                  {!label.is_default && (
                    <button
                      onClick={() => handleDelete(label)}
                      disabled={isPending && pendingId === label.id}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                      title={`Delete label: ${label.name}`}
                      aria-label={`Delete label: ${label.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
