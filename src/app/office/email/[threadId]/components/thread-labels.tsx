'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { LabelChip } from '@/modules/email-labels/components/label-chip'
import { assignLabelToThreadAction, removeLabelFromThreadAction, createAndAssignLabelAction } from '../actions'

type Assignment = { id: string; label_id: string; name: string; color_hex: string }
type AvailableLabel = { id: string; name: string; color_hex: string }

export function ThreadLabels({
  threadId,
  assignments,
  availableLabels,
}: {
  threadId: string
  assignments: Assignment[]
  availableLabels: AvailableLabel[]
}) {
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setShowCreateForm(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const appliedIds = new Set(assignments.map((a) => a.label_id))
  const options = availableLabels.filter(
    (l) => !appliedIds.has(l.id) && l.name.toLowerCase().includes(search.toLowerCase())
  )

  function handleRemove(assignmentId: string) {
    startTransition(async () => {
      await removeLabelFromThreadAction(assignmentId, threadId)
    })
  }

  function handleAdd(labelId: string) {
    startTransition(async () => {
      setError(null)
      const result = await assignLabelToThreadAction(threadId, labelId)
      if (result.error) setError(result.error)
      else {
        setIsOpen(false)
        setSearch('')
      }
    })
  }

  function handleCreate(formData: FormData) {
    startTransition(async () => {
      setError(null)
      const result = await createAndAssignLabelAction(threadId, formData)
      if (result.error) setError(result.error)
      else {
        setIsOpen(false)
        setShowCreateForm(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-2 flex-wrap" ref={containerRef}>
      {assignments.map((a) => (
        <LabelChip key={a.id} name={a.name} colorHex={a.color_hex} onRemove={() => handleRemove(a.id)} />
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          disabled={isPending}
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-slate-500 border border-dashed border-slate-300 rounded-full hover:bg-slate-50 transition-colors"
        >
          <Plus size={12} />
          Add label
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
            {!showCreateForm ? (
              <>
                <div className="p-2 border-b border-slate-100">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search labels..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {options.length === 0 && (
                    <p className="px-3 py-3 text-xs text-slate-400">No matching labels.</p>
                  )}
                  {options.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => handleAdd(label.id)}
                      className="w-full flex items-center px-3 py-2 hover:bg-slate-50 transition-colors text-left"
                    >
                      <LabelChip name={label.name} colorHex={label.color_hex} />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-slate-50 border-t border-slate-100 transition-colors"
                >
                  + Create new label…
                </button>
              </>
            ) : (
              <form action={handleCreate} className="p-3 space-y-2">
                <input
                  autoFocus
                  name="name"
                  type="text"
                  placeholder="Label name"
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
                <input
                  name="color_hex"
                  type="color"
                  defaultValue="#3B82F6"
                  className="h-8 w-16 border border-slate-300 rounded cursor-pointer"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 px-2 py-1.5 text-xs font-medium bg-[var(--color-primary)] hover:bg-blue-700 text-white rounded disabled:opacity-50 transition-colors"
                  >
                    Create & apply
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  )
}
