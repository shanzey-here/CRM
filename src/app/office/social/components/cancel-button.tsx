'use client'

import { useState, useTransition } from 'react'
import { cancelScheduledPostAction } from '../actions'

export function CancelButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)

  if (cancelled) {
    return <span className="text-xs text-slate-400 italic">Cancelled</span>
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => {
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
        className="text-xs text-red-600 hover:underline disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? 'Cancelling...' : 'Cancel'}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </div>
  )
}
