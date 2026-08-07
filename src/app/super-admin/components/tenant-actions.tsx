'use client'

import { useState } from 'react'
import { suspendTenantAction, reactivateTenantAction } from '../actions'

export function TenantActions({ tenantId, isSuspended }: { tenantId: string, isSuspended: boolean }) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      if (isSuspended) {
        const res = await reactivateTenantAction(tenantId)
        if (res.error) setError(res.error)
        else setIsOpen(false)
      } else {
        if (!reason.trim()) {
          setError('Reason is required')
          setLoading(false)
          return
        }
        const res = await suspendTenantAction(tenantId, reason)
        if (res.error) setError(res.error)
        else {
          setIsOpen(false)
          setReason('')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (isSuspended) {
    return (
      <form onSubmit={handleAction}>
        <button 
          type="submit" 
          disabled={loading}
          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium transition-colors"
        >
          {loading ? 'Reactivating...' : 'Reactivate'}
        </button>
      </form>
    )
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="border-2 border-[var(--color-destructive)] text-[var(--color-destructive)] bg-transparent hover:bg-red-50 hover:text-red-700 font-medium rounded-md px-3 py-1.5 transition-colors text-sm"
      >
        Suspend
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Suspend Tenant</h3>
            <p className="text-sm text-slate-500 mb-4">
              This will immediately lock all staff out of the system. This action is audited.
            </p>
            
            <form onSubmit={handleAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason for Suspension
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Policy violation"
                  className="w-full bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-destructive)] focus:border-transparent"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
                >
                  {loading ? 'Suspending...' : 'Confirm Suspension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
