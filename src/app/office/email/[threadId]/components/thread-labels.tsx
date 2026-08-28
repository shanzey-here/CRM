'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { Plus, Tag, Search, X, Loader2 } from 'lucide-react'
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
    <div className="flex items-center gap-1.5 flex-wrap" ref={containerRef}>
      {assignments.map((a) => (
        <LabelChip
          key={a.id}
          name={a.name}
          colorHex={a.color_hex}
          onRemove={() => handleRemove(a.id)}
          variant="subtle"
          size="sm"
        />
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-full transition-colors shadow-2xs"
        >
          <Plus size={12} className="text-slate-500" />
          <span>Add label</span>
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden space-y-1">
            {!showCreateForm ? (
              <>
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search labels..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
                  {options.length === 0 && (
                    <p className="px-3 py-3 text-xs text-slate-400 text-center">No matching labels.</p>
                  )}
                  {options.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => handleAdd(label.id)}
                      className="w-full flex items-center px-2.5 py-1.5 hover:bg-slate-50 rounded-lg transition-colors text-left"
                    >
                      <LabelChip name={label.name} colorHex={label.color_hex} variant="subtle" size="sm" />
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border-t border-slate-100 transition-colors flex items-center gap-1.5"
                >
                  <Tag className="h-3 w-3" />
                  <span>Create new custom label…</span>
                </button>
              </>
            ) : (
              <form action={handleCreate} className="p-3 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800">New Custom Label</div>
                <input
                  autoFocus
                  name="name"
                  type="text"
                  placeholder="Label name (e.g. VIP Client)"
                  required
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Pick color:</span>
                  <input
                    name="color_hex"
                    type="color"
                    defaultValue="#059669"
                    className="h-7 w-12 border border-slate-200 rounded cursor-pointer"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50 transition-colors shadow-2xs"
                  >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" /> : 'Create'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600 w-full mt-1">{error}</p>}
    </div>
  )
}
