'use client'

import { useState, useTransition } from 'react'
import { suspendTenantAction, reactivateTenantAction } from '../actions'
import { Loader2, X, AlertTriangle, ShieldCheck } from 'lucide-react'

export function TenantActions({
  tenantId,
  isSuspended,
}: {
  tenantId: string
  isSuspended: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isReactivateOpen, setIsReactivateOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError('Suspension reason is required')
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        const res = await suspendTenantAction(tenantId, reason)
        if (res.error) {
          setError(res.error)
        } else {
          setIsOpen(false)
          setReason('')
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to suspend workspace')
      }
    })
  }

  const handleReactivate = async () => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await reactivateTenantAction(tenantId)
        if (res.error) {
          setError(res.error)
        } else {
          setIsReactivateOpen(false)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to reactivate workspace')
      }
    })
  }

  if (isSuspended) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsReactivateOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
          title="Reactivate this workspace and restore staff access"
          aria-label="Reactivate workspace"
        >
          <ShieldCheck size={14} />
          Reactivate
        </button>

        {isReactivateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={18} />
                  Reactivate Workspace
                </h3>
                <button
                  type="button"
                  onClick={() => setIsReactivateOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-sm text-slate-600 my-4">
                Are you sure you want to restore access for this workspace? Staff and admins will be able to log in again immediately.
              </p>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs mb-4">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReactivateOpen(false)}
                  disabled={isPending}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReactivate}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  Confirm Reactivation
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
        title="Suspend this workspace and lock staff out"
        aria-label="Suspend workspace"
      >
        <AlertTriangle size={13} />
        Suspend
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={18} />
                Suspend Workspace
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-500 my-3">
              This will immediately lock all workspace users out of the system. This action is audited.
            </p>

            <form onSubmit={handleSuspend} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason for Suspension <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Terms of Service violation, non-payment"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent shadow-sm"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-xs">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  {isPending && <Loader2 size={13} className="animate-spin" />}
                  Confirm Suspension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
