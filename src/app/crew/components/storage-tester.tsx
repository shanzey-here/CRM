'use client'

import { useState, useEffect } from 'react'
import { getOffline, setOffline } from '@/lib/offline-storage'

export function StorageTester() {
  const [val, setVal] = useState<string>('')
  const [input, setInput] = useState<string>('')
  const [status, setStatus] = useState<string>('Initializing...')

  useEffect(() => {
    const loadInit = async () => {
      try {
        const saved = await getOffline<string>('test-key')
        setVal(saved || 'Nothing saved yet.')
        setStatus('Loaded from IndexedDB.')
      } catch (err: any) {
        setStatus(`Error reading: ${err.message}`)
      }
    }
    loadInit()
  }, [])

  const handleSave = async () => {
    try {
      setStatus('Saving...')
      await setOffline('test-key', input)
      setVal(input)
      setInput('')
      setStatus('Saved to IndexedDB successfully!')
    } catch (err: any) {
      setStatus(`Error saving: ${err.message}`)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mt-6">
      <h2 className="text-lg font-semibold mb-2">Offline Storage Tester</h2>
      <p className="text-sm text-gray-500 mb-4">
        This uses IndexedDB to securely store data offline without reaching storage limits.
        Disable your network connection, refresh the page, and verify this data still loads!
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Current Value:</label>
        <div className="bg-gray-50 p-3 rounded text-sm font-mono break-words border border-gray-100">
          {val}
        </div>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a value to save..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button 
          onClick={handleSave}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded font-medium transition-colors"
        >
          Save Data
        </button>
      </div>

      <div className="mt-4 text-xs font-medium text-slate-500">
        Status: <span className={status.includes('Error') ? 'text-red-500' : 'text-emerald-600'}>{status}</span>
      </div>
    </div>
  )
}
