'use client'

import { useState, useTransition } from 'react'
import { reassignCrateStorageUnitAction } from '../../../actions'

type Unit = { id: string; unit_number: string }

export function StorageUnitSelect({ crateId, currentUnitId, units }: { crateId: string; currentUnitId: string | null; units: Unit[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <select
        defaultValue={currentUnitId ?? ''}
        disabled={isPending}
        onChange={(e) => {
          setError(null)
          const value = e.target.value || null
          startTransition(async () => {
            const result = await reassignCrateStorageUnitAction(crateId, value)
            if (!result.success) setError(result.error)
          })
        }}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
      >
        <option value="">Unassigned</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.unit_number}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
