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
        className="flex items-center gap-2 bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
      >
        <Plus size={18} />
        Create Tenant
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 text-slate-900 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">
                {successData ? 'Tenant Created Successfully' : 'Create New Tenant'}
              </h2>
              <button 
                onClick={resetState}
                className="text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {successData ? (
              <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg text-sm">
                  Workspace <strong className="font-semibold text-blue-900">{successData.tenantName}</strong> has been provisioned.
                </div>
                
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    A first admin user has been created. Please share these temporary login credentials with them securely:
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm space-y-2">
                    <div className="flex justify-between items-center group">
                      <span className="text-slate-500">Email:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-900">{successData.adminEmail}</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(successData.adminEmail)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-900 transition-all bg-white shadow-sm border border-slate-200 rounded"
                          title="Copy Email"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center group">
                      <span className="text-slate-500">Temp Password:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 font-bold">{successData.generatedPassword}</span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(successData.generatedPassword || '')}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-900 transition-all bg-white shadow-sm border border-slate-200 rounded"
                          title="Copy Password"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={resetState}
                  className="w-full bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Workspace Name
                  </label>
                  <input 
                    name="name" 
                    required
                    placeholder="e.g. Acme Removals"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-slate-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    URL Slug
                  </label>
                  <div className="flex items-center">
                    <span className="bg-slate-50 border border-slate-300 border-r-0 rounded-l-md px-3 py-2 text-slate-500 text-sm font-mono">
                      app.gomove.com/
                    </span>
                    <input 
                      name="slug" 
                      required
                      placeholder="acme"
                      className="w-full bg-white border border-slate-300 rounded-r-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    First Admin Email
                  </label>
                  <input 
                    name="adminEmail" 
                    type="email" 
                    required
                    placeholder="admin@acme.com"
                    className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent text-slate-900"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    A temporary password will be generated for this user.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-sm">
                    {error}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={resetState}
                    className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="bg-[var(--color-primary)] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                  >
                    {isLoading && <Loader2 size={16} className="animate-spin" />}
                    Create Workspace
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
