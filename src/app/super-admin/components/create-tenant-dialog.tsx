'use client'

import { useState } from 'react'
import { createTenant } from '../actions'
import { Plus, X, Loader2 } from 'lucide-react'

export function CreateTenantDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const result = await createTenant(formData)
    
    setIsLoading(false)
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setIsOpen(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
      >
        <Plus size={18} />
        Create Tenant
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold">Create New Tenant</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2 rounded text-sm">
                  {error}
                </div>
              )}
              
              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium text-slate-300">Tenant Name</label>
                <input 
                  id="name" 
                  name="name" 
                  type="text" 
                  required
                  placeholder="e.g. Swift Removals Ltd"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="slug" className="text-sm font-medium text-slate-300">URL Slug</label>
                <input 
                  id="slug" 
                  name="slug" 
                  type="text" 
                  required
                  pattern="[a-z0-9-]+"
                  placeholder="e.g. swift-removals"
                  className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500">Only lowercase letters, numbers, and hyphens.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="flex items-center justify-center w-24 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-sm font-medium transition-colors"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
