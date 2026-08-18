'use client'

import { useState } from 'react'
import { createVehicleAction } from '../actions'

export default function CreateVehicleForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const result = await createVehicleAction(formData)
    
    if (result.success) {
      setOpen(false)
    } else {
      setError(result.error || 'Failed to create vehicle')
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
      >
        Add Vehicle
      </button>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Vehicle</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-red-600 text-sm">{error}</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
            <input 
              name="name"
              type="text"
              required
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g. Luton Van A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration</label>
            <input 
              name="registration"
              type="text"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g. AB12 CDE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <input 
              name="type"
              type="text"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g. Luton, Sprinter"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (Cubic ft)</label>
            <input 
              name="capacityCubic"
              type="number"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g. 500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button 
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Vehicle'}
          </button>
        </div>
      </form>
    </div>
  )
}
