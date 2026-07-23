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
          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
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
        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
      >
        Suspend
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-2">Suspend Tenant</h3>
            <p className="text-sm text-slate-400 mb-4">
              This will immediately lock all staff out of the system. This action is audited.
            </p>
            
            <form onSubmit={handleAction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Reason for Suspension
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Policy violation"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-red-500"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
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
