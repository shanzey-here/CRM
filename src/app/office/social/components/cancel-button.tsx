'use client'

import { useState, useTransition } from 'react'
import { cancelScheduledPostAction } from '../actions'
import { Ban, Loader2 } from 'lucide-react'

export function CancelButton({ postId, variant = 'button' }: { postId: string; variant?: 'button' | 'compact' }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  if (cancelled) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-500 italic">
        <Ban className="w-3 h-3" />
        Cancelled
      </span>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setError(null)
          startTransition(async () => {
            const result = await cancelScheduledPostAction(postId)
            if (!result.success) {
              setError(result.error)
              return
            }
            setCancelled(true)
          })
        }}
        disabled={isPending}
        className={
          variant === 'compact'
            ? 'inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer'
        }
      >
        {isPending ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Cancelling...</span>
          </>
        ) : (
          <>
            <Ban className="w-3 h-3" />
            <span>Cancel Post</span>
          </>
        )}
      </button>
      {error && <span className="text-[11px] text-red-600 font-medium">{error}</span>}
    </div>
  )
}
