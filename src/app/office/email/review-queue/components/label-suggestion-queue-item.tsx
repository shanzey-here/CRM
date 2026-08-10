'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { approveLabelSuggestionAction, rejectLabelSuggestionAction } from '../actions'

export function LabelSuggestionQueueItem({ suggestionId, threadId, labelId }: { suggestionId: string; threadId: string; labelId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleApprove() {
    startTransition(async () => {
      setError(null)
      const result = await approveLabelSuggestionAction(suggestionId, threadId, labelId)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  function handleReject() {
    startTransition(async () => {
      setError(null)
      const result = await rejectLabelSuggestionAction(suggestionId, threadId, labelId)
      if (result.error) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          onClick={handleApprove}
          disabled={isPending}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] hover:bg-blue-700 text-white rounded-md disabled:opacity-50 transition-colors"
        >
          <Check size={14} />
          Apply label
        </button>
        <button
          onClick={handleReject}
          disabled={isPending}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-50 transition-colors"
        >
          <X size={14} />
          Dismiss
        </button>
      </div>
    </div>
  )
}
