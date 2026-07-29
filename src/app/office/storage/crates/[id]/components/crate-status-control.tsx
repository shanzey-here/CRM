'use client'

import { useState, useTransition } from 'react'
import { changeCrateStatusAction } from '../../../actions'
import { CRATE_STATUS_TRANSITIONS, CRATE_STATUS_LABELS, ALL_CRATE_STATUSES, CrateStatus } from '@/modules/storage/transitions'

const STATUS_BADGE: Record<string, string> = {
  in_warehouse: 'bg-slate-50 text-slate-600 ring-slate-500/10',
  reserved: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  with_customer: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  returned: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  lost: 'bg-red-50 text-red-700 ring-red-600/20',
  damaged: 'bg-red-50 text-red-700 ring-red-600/20',
}

export function CrateStatusControl({ crateId, currentStatus }: { crateId: string; currentStatus: CrateStatus }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const isTerminal = CRATE_STATUS_TRANSITIONS[currentStatus].length === 0
  const showDropdown = !isTerminal || overrideOpen
  const options = overrideOpen ? ALL_CRATE_STATUSES.filter((s) => s !== currentStatus) : CRATE_STATUS_TRANSITIONS[currentStatus]

  function handleChange(newStatus: string) {
    if (!newStatus) return
    setError(null)
    startTransition(async () => {
      const result = await changeCrateStatusAction(crateId, newStatus, overrideOpen)
      if (!result.success) {
        setError(result.error)
        return
      }
      setOverrideOpen(false)
    })
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ring-1 ring-inset ${STATUS_BADGE[currentStatus] ?? ''}`}>
          {CRATE_STATUS_LABELS[currentStatus]}
        </span>

        {showDropdown && (
          <select
            value=""
            disabled={isPending}
            onChange={(e) => handleChange(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
          >
            <option value="" disabled>
              {overrideOpen ? 'Force change to...' : 'Change to...'}
            </option>
            {options.map((status) => (
              <option key={status} value={status}>
                {CRATE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        )}

        {isTerminal && !overrideOpen && (
          <button onClick={() => setOverrideOpen(true)} className="text-xs text-slate-500 hover:text-slate-800 underline">
            Override status
          </button>
        )}
        {isTerminal && overrideOpen && (
          <button onClick={() => setOverrideOpen(false)} className="text-xs text-slate-500 hover:text-slate-800">
            Cancel override
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      {isTerminal && !overrideOpen && (
        <p className="text-xs text-slate-400 mt-2">This crate is in a terminal state — normal transitions are disabled. Use "Override status" to change it anyway.</p>
      )}
    </div>
  )
}
