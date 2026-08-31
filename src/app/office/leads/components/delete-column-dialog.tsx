'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Trash2, X, Loader2, ShieldAlert } from 'lucide-react'
import type { PipelineStageDef } from '@/modules/leads/schemas'
import { deletePipelineStageAction } from '../actions'

interface DeleteColumnDialogProps {
  stage: PipelineStageDef | null
  isOpen: boolean
  onClose: () => void
  activeLeadsCount: number
  availableFallbackStages: PipelineStageDef[]
  onColumnDeleted?: (deletedStageId: string, fallbackStageId?: string) => void
}

export function DeleteColumnDialog({
  stage,
  isOpen,
  onClose,
  activeLeadsCount,
  availableFallbackStages,
  onColumnDeleted,
}: DeleteColumnDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [fallbackStageId, setFallbackStageId] = useState<string>(
    availableFallbackStages[0]?.id ?? ''
  )

  if (!isOpen || !stage) return null

  function handleClose() {
    setServerError(null)
    onClose()
  }

  const handleDelete = () => {
    setServerError(null)
    startTransition(async () => {
      const result = await deletePipelineStageAction({
        stageId: stage.id,
        fallbackStageId: activeLeadsCount > 0 ? fallbackStageId : undefined,
      })

      if (!result.success) {
        setServerError(result.error)
        return
      }

      onColumnDeleted?.(stage.id, activeLeadsCount > 0 ? fallbackStageId : undefined)
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
      data-testid="delete-column-dialog-backdrop"
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-column-dialog-title"
        data-testid="delete-column-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-red-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
              {stage.is_system ? (
                <ShieldAlert className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </div>
            <h2
              id="delete-column-dialog-title"
              className="text-base font-semibold text-slate-900"
            >
              {stage.is_system ? 'System Stage Protected' : 'Delete Pipeline Column'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {serverError && (
            <div
              role="alert"
              className="p-3 text-sm rounded-lg bg-red-50 border border-red-200 text-red-700 font-medium"
              data-testid="delete-column-error"
            >
              {serverError}
            </div>
          )}

          {stage.is_system ? (
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                <strong className="text-slate-900">{stage.name}</strong> is a built-in
                system pipeline stage.
              </p>
              <p className="text-xs text-slate-500">
                System stages cannot be deleted as they are essential to core workflow
                automation (e.g. quote generation, surveys, calendar scheduling). You may
                still rename this stage to fit your company terminology.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{' '}
                <strong className="text-slate-900 font-semibold">{stage.name}</strong>?
              </p>

              {activeLeadsCount > 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        {activeLeadsCount} Active Lead{activeLeadsCount > 1 ? 's' : ''} in Column
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        To prevent orphan leads, please choose a stage to move them to before
                        deleting this column.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="fallback-stage-select"
                      className="block text-xs font-semibold uppercase tracking-wider text-amber-900 mb-1"
                    >
                      Move active leads to:
                    </label>
                    <select
                      id="fallback-stage-select"
                      value={fallbackStageId}
                      onChange={(e) => setFallbackStageId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      data-testid="fallback-stage-select"
                    >
                      {availableFallbackStages.map((fallback) => (
                        <option key={fallback.id} value={fallback.id}>
                          {fallback.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                  ✓ This column currently has no active leads and can be safely removed.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            {stage.is_system ? 'Close' : 'Cancel'}
          </button>

          {!stage.is_system && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending || (activeLeadsCount > 0 && !fallbackStageId)}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="delete-column-confirm-button"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {activeLeadsCount > 0 ? 'Move Leads & Delete' : 'Delete Column'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
