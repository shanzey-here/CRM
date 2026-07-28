'use client'

import { useState, useTransition } from 'react'
import { approveAiDraftAction, discardAiDraftAction } from '../actions'
import { Loader2, Check, Trash2 } from 'lucide-react'

// Rendered by MessageList only for authored_by === 'ai_draft_pending' rows.
// Same useTransition + red-error-banner pattern as reply-composer.tsx, so
// the review workflow feels consistent with the existing send flow rather
// than like a bolted-on second UI.
export function AiDraftReview({ messageId, initialBody }: { messageId: string; initialBody: string }) {
  const [body, setBody] = useState(initialBody)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [resolved, setResolved] = useState(false)

  function handleApprove() {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await approveAiDraftAction(messageId, body)
      if (!result.success) {
        setError(result.error)
        return
      }
      if (!result.recorded) {
        setWarning(result.warning)
      }
      setResolved(true)
    })
  }

  function handleDiscard() {
    setError(null)
    startTransition(async () => {
      const result = await discardAiDraftAction(messageId)
      if (!result.success) {
        setError(result.error || 'Failed to discard draft')
        return
      }
      setResolved(true)
    })
  }

  if (resolved) {
    return (
      <div className="text-xs text-slate-500 italic">
        {warning ?? 'Sent.'}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {error && <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        disabled={isPending}
        className="w-full px-3 py-2 border border-amber-300 rounded text-sm bg-white focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:opacity-50"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={handleDiscard}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-600 rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Discard
        </button>
        <button
          onClick={handleApprove}
          disabled={isPending || !body.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Approve &amp; Send
        </button>
      </div>
    </div>
  )
}
