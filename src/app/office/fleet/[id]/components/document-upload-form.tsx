'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { addVehicleDocumentAction } from '../../actions'

type DocumentUploadFormProps = {
  vehicleId: string
  tenantId: string
}

export default function DocumentUploadForm({ vehicleId, tenantId }: DocumentUploadFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const form = e.currentTarget
      const fileInput = form.elements.namedItem('file') as HTMLInputElement
      const file = fileInput.files?.[0]
      
      if (!file) throw new Error('Please select a file to upload')

      const documentType = (form.elements.namedItem('documentType') as HTMLSelectElement).value
      const expiryDate = (form.elements.namedItem('expiryDate') as HTMLInputElement).value
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${documentType}_${Date.now()}.${fileExt}`
      const storagePath = `${tenantId}/${fileName}`

      // 1. Direct upload to Storage using authenticated client
      const { error: uploadError } = await supabase.storage
        .from('vehicle-documents')
        .upload(storagePath, file, { upsert: true })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      // 2. Add metadata to DB
      const formData = new FormData()
      formData.append('vehicleId', vehicleId)
      formData.append('documentType', documentType)
      formData.append('filePath', storagePath)
      if (expiryDate) formData.append('expiryDate', expiryDate)

      const result = await addVehicleDocumentAction(formData)
      if (!result.success) {
        throw new Error(result.error || 'Failed to save document record')
      }

      setOpen(false)
      form.reset()
    } catch (err: any) {
      console.error('Document upload error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button 
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
      >
        Upload Document
      </button>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Document</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="text-red-600 text-sm">{error}</div>}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
            <select
              name="documentType"
              required
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border bg-white"
            >
              <option value="insurance">Insurance</option>
              <option value="mot">MOT</option>
              <option value="logbook">Logbook</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
            <input 
              name="expiryDate"
              type="date"
              className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File <span className="text-red-500">*</span></label>
            <input 
              name="file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg"
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
            {loading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </form>
    </div>
  )
}
