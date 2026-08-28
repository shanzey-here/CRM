'use client'

import { useState, useTransition } from 'react'
import { sendReplyAction } from '../actions'
import { Loader2, Send, AlertTriangle, CornerDownRight } from 'lucide-react'

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
  const [unrecorded, setUnrecorded] = useState<{ body: string; warning: string }[]>([])

  function handleSend() {
    if (!body.trim()) return
    setError(null)
    const textToSend = body

    startTransition(async () => {
      const result = await sendReplyAction(threadId, textToSend)

      if (!result.success) {
        setError(result.error)
        return
      }

      setBody('')

      if (!result.recorded) {
        setUnrecorded((prev) => [...prev, { body: textToSend, warning: result.warning }])
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-3">
      {unrecorded.map((u, i) => (
        <div key={i} className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 ml-4 sm:ml-10">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs font-semibold text-amber-800">{u.warning}</span>
          </div>
          <p className="text-xs sm:text-sm text-amber-900 whitespace-pre-wrap">{u.body}</p>
        </div>
      ))}

      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <CornerDownRight className="h-3.5 w-3.5 text-emerald-600" />
            <span>Replying from: <span className="font-medium text-slate-800">{mailboxAddress}</span></span>
          </div>
          <span className="text-slate-400 hidden sm:inline">Press Cmd + Enter to send</span>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Write your email reply to the customer..."
          disabled={isPending}
          className="w-full px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 disabled:opacity-50 transition-all placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-400">
            Outbound email will be signed and delivered via connected SMTP / Gmail.
          </div>

          <button
            onClick={handleSend}
            disabled={isPending || !body.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Send Reply</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
