'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateStorageUnitAction } from '../../actions'

type Unit = {
  id: string
  unit_number: string
  capacity_cubic_feet: number
  is_available: boolean
  location_notes: string | null
}

export function UnitRow({ unit }: { unit: Unit }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [unitNumber, setUnitNumber] = useState(unit.unit_number)
  const [capacity, setCapacity] = useState(String(unit.capacity_cubic_feet))
  const [isAvailable, setIsAvailable] = useState(unit.is_available)
  const [locationNotes, setLocationNotes] = useState(unit.location_notes ?? '')

  if (!isEditing) {
    return (
      <tr 
        onClick={() => router.push(`/office/storage/units/${unit.id}`)}
        className="hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">{unit.unit_number}</td>
        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">{unit.capacity_cubic_feet} cu ft</td>
        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
          <span
            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
              unit.is_available ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-slate-50 text-slate-600 ring-slate-500/10'
            }`}
          >
            {unit.is_available ? 'Available' : 'Unavailable'}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">{unit.location_notes || '—'}</td>
        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
          <button 
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }} 
            className="text-blue-600 hover:text-blue-900 relative z-10"
          >
            Edit
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={5} className="px-4 py-4 sm:px-6">
        {error && <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
          <input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" step="any" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="rounded border-slate-300" />
            Available
          </label>
          <input value={locationNotes} onChange={(e) => setLocationNotes(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          <div className="flex gap-2">
            <button
              disabled={isPending}
              onClick={() => {
                setError(null)
                startTransition(async () => {
                  const formData = new FormData()
                  formData.append('unitNumber', unitNumber)
                  formData.append('capacityCubicFeet', capacity)
                  formData.append('isAvailable', String(isAvailable))
                  formData.append('locationNotes', locationNotes)
                  const result = await updateStorageUnitAction(unit.id, formData)
                  if (!result.success) {
                    setError(result.error)
                    return
                  }
                  setIsEditing(false)
                })
              }}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-slate-600 text-xs font-medium hover:text-slate-900">
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}
