'use client'

import { useState } from 'react'
import { createTenant } from '../actions'
import { Plus, X, Loader2 } from 'lucide-react'

export function CreateTenantDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // State to show the generated password after creation
  const [successData, setSuccessData] = useState<{
    tenantName: string
    adminEmail: string
    generatedPassword?: string
  } | null>(null)

  function resetState() {
    setIsOpen(false)
    setIsLoading(false)
    setError(null)
    setSuccessData(null)
  }

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
      setSuccessData({
        tenantName: formData.get('name') as string,
        adminEmail: formData.get('adminEmail') as string,
        generatedPassword: result.generatedPassword
      })
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
              <h2 className="text-lg font-semibold">
                {successData ? 'Tenant Created Successfully' : 'Create New Tenant'}
              </h2>
              <button 
                onClick={resetState}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {successData ? (
              <div className="p-6 space-y-6">
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">
                  Workspace <strong>{successData.tenantName}</strong> has been provisioned.
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm text-slate-300">
                    A first admin user has been created. Please share these temporary login credentials with them securely:
                  </p>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-sm space-y-2">
                    <div className="flex justify-between items-center group">
                      <span className="text-slate-500">Email:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white">{successData.adminEmail}</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(successData.adminEmail)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-all bg-slate-800 rounded"
                          title="Copy Email"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center group">
                      <span className="text-slate-500">Temp Password:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-bold">{successData.generatedPassword}</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(successData.generatedPassword || '')}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white transition-all bg-slate-800 rounded"
                          title="Copy Password"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 text-center">
                    Note: Email verification was waived. They can log in immediately.
                  </p>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    onClick={resetState}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-md font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
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

                <hr className="border-slate-800 my-4" />

                <div className="space-y-1.5">
                  <label htmlFor="adminFullName" className="text-sm font-medium text-slate-300">First Admin Full Name</label>
                  <input 
                    id="adminFullName" 
                    name="adminFullName" 
                    type="text" 
                    required
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="adminEmail" className="text-sm font-medium text-slate-300">First Admin Email</label>
                  <input 
                    id="adminEmail" 
                    name="adminEmail" 
                    type="email" 
                    required
                    placeholder="e.g. admin@swiftremovals.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-slate-500">A secure temporary password will be auto-generated.</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={resetState}
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
            )}
          </div>
        </div>
      )}
    </>
  )
}
