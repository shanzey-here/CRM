'use client'

import { useState } from 'react'
import { addVehicleMaintenanceAction } from '../../actions'

export default function MaintenanceLogForm({ vehicleId }: { vehicleId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    formData.append('vehicleId', vehicleId)
    
    const result = await addVehicleMaintenanceAction(formData)
    
    if (result.success) {
      setOpen(false)
    } else {
      setError(result.error || 'Failed to log maintenance')
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
      >
        Log Maintenance
      </button>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Log Maintenance Record</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-red-600 text-sm">{error}</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
            <select
              name="maintenanceType"
              required
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
            >
              <option value="service">Service</option>
              <option value="repair">Repair</option>
              <option value="inspection">Inspection</option>
              <option value="tyres">Tyres</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Performed <span className="text-red-500">*</span></label>
            <input 
              name="performedAt"
              type="date"
              required
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cost (£)</label>
            <input 
              name="cost"
              type="number"
              step="0.01"
              min="0"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              placeholder="e.g. 150.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Next Due Date</label>
            <input 
              name="nextDueDate"
              type="date"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea 
            name="notes"
            rows={2}
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            placeholder="Details about the work performed..."
          />
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
            {loading ? 'Saving...' : 'Save Record'}
          </button>
        </div>
      </form>
    </div>
  )
}
