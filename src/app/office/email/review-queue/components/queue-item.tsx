'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { approveAiDraftAction, discardAiDraftAction } from '../../[threadId]/actions'
import { Loader2, Check, Trash2, AlertTriangle } from 'lucide-react'

// Deliberately matches ai-draft-review.tsx's exact interaction pattern
// (editable textarea, Approve & Send / Discard, useTransition, red error
// banner) rather than inventing a new one — this is a new surface calling
// the same existing actions, not a second implementation. The one real
// difference: on success this calls router.refresh() instead of showing a
// local "resolved" state, since a resolved row needs to actually leave this
// list, and neither action's revalidatePath touches this route.
export function QueueItem({
  messageId,
  initialBody,
  claimedAt,
}: {
  messageId: string
  initialBody: string
  claimedAt: string | null
}) {
  const router = useRouter()
  const [body, setBody] = useState(initialBody)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // A row can be claimed_at-set while still authored_by='ai_draft_pending'
  // in exactly two cases: genuinely mid-send (sub-second, another request),
  // or permanently stuck after a send-succeeded-but-record-failed outcome.
  // Both Approve and Discard would just cleanly no-op/fail against a row
  // like this, so don't offer them — surface the real state instead.
  if (claimedAt) {
    return (
      <div className="flex items-center gap-2 p-3 rounded border border-amber-200 bg-amber-50 text-xs text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        This may already have been sent — check the mailbox's Sent folder before taking action.
      </div>
    )
  }

  function handleApprove() {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await approveAiDraftAction(messageId, body)
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
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
      router.refresh()
    })
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
