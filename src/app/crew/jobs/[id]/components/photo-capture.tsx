'use client'

import { useRef, useState } from 'react'
import { queuePhotoUpload } from '@/lib/offline-storage'
import { Camera } from 'lucide-react'

export function PhotoCapture({ jobId, onPhotoQueued }: { jobId: string, onPhotoQueued: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [caption, setCaption] = useState('')
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsCapturing(true)
    setError(null)
    try {
      const uploadId = crypto.randomUUID()
      await queuePhotoUpload({
        id: uploadId,
        jobId,
        file,
        caption: caption || 'Job Photo',
        status: 'pending',
        createdAt: Date.now()
      })
      onPhotoQueued()
      setCaption('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error('Failed to queue photo', err)
      setError('Failed to save photo offline. Please try again.')
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mt-4">
      <h3 className="text-lg font-medium text-slate-900 mb-3">Add Photo</h3>
      {error && (
        <div className="mb-3 p-3 text-sm bg-red-50 border border-red-200 text-red-600 rounded-md">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-3">
        <input
          type="text"
          placeholder="Caption (e.g. Before condition, Damage found)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="border border-slate-300 rounded px-3 py-2 text-sm"
        />
        <div>
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            ref={fileInputRef}
            onChange={handleCapture}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isCapturing}
            className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md font-medium disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span>Take Photo</span>
          </button>
        </div>
      </div>
    </div>
  )
}
