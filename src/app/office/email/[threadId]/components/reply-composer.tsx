'use client'

import { useState, useTransition } from 'react'
import { sendReplyAction } from '../actions'
import { Loader2, Send, AlertTriangle } from 'lucide-react'

export function ReplyComposer({
  threadId,
  mailboxAddress,
}: {
  threadId: string
  mailboxId: string
  mailboxAddress: string
  subject: string
  participantAddresses: string[]
}) {
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Sent-but-not-recorded messages are local-only, by design — the DB has
  // no row for them, so persisting this in any client store would be
  // dishonest about what the CRM actually knows. They exist only long
  // enough to prove to the dispatcher what they just sent.
  const [unrecorded, setUnrecorded] = useState<{ body: string; warning: string }[]>([])

  function handleSend() {
    if (!body.trim()) return
    setError(null)
    const textToSend = body

    startTransition(async () => {
      const result = await sendReplyAction(threadId, textToSend)

      if (!result.success) {
        // Never sent — safe to leave the text in the box for the dispatcher to retry.
        setError(result.error)
        return
      }

      setBody('')

      if (!result.recorded) {
        // Sent for real, DB write failed. Never re-offer to "retry" this —
        // that would send a real duplicate to the customer.
        setUnrecorded((prev) => [...prev, { body: textToSend, warning: result.warning }])
      }
    })
  }

  return (
    <div className="space-y-3">
      {unrecorded.map((u, i) => (
        <div key={i} className="p-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 ml-8">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs font-medium text-amber-800">{u.warning}</span>
          </div>
          <p className="text-sm text-amber-900 whitespace-pre-wrap">{u.body}</p>
        </div>
      ))}

      <div className="bg-white rounded-lg border border-slate-200 p-4">
        {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs">{error}</div>}
        <p className="text-xs text-slate-500 mb-2">Replying as {mailboxAddress}</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Write your reply..."
          disabled={isPending}
          className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSend}
            disabled={isPending || !body.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Reply
          </button>
        </div>
      </div>
    </div>
  )
}
