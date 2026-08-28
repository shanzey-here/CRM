import { User, Bot, Clock, Sparkles, Send } from 'lucide-react'
import { AiDraftReview } from './ai-draft-review'

type Message = {
  id: string
  direction: string
  from_address: string
  to_addresses: string[] | null
  body_text: string | null
  authored_by: string
  requires_approval: boolean
  occurred_at: string | null
  source_message_id: string | null
  ai_metadata?: any
}

function AuthorBadge({ authoredBy, requiresApproval }: { authoredBy: string; requiresApproval: boolean }) {
  if (authoredBy === 'human') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <User className="h-3 w-3 text-slate-500" />
        Staff
      </span>
    )
  }
  if (authoredBy === 'ai_sent') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
        <Sparkles className="h-3 w-3 text-emerald-600" />
        AI Auto-Sent
      </span>
    )
  }
  if (authoredBy === 'ai_draft_pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-200">
        <Clock className="h-3 w-3 text-amber-600" />
        {requiresApproval ? 'AI Draft — Awaiting Review' : 'AI Draft'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
      {authoredBy}
    </span>
  )
}

function formatMessageDate(iso: string | null): string {
  if (!iso) return 'Not yet sent'
  const date = new Date(iso)
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-sm text-slate-500 shadow-xs">
        No messages recorded in this conversation yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isOutbound = message.direction === 'outbound'
        const isAiDraft = message.authored_by === 'ai_draft_pending'

        return (
          <div
            key={message.id}
            className={`p-5 rounded-xl border transition-all shadow-xs ${
              isAiDraft
                ? 'bg-amber-50/40 border-amber-200 ml-4 sm:ml-10 ring-1 ring-amber-200/50'
                : isOutbound
                ? 'bg-emerald-50/30 border-emerald-200/80 ml-4 sm:ml-10'
                : 'bg-white border-slate-200/90 mr-4 sm:mr-10'
            }`}
          >
            {/* Header: Sender, Badge, Timestamp */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 border ${
                    isOutbound
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {isOutbound ? (isAiDraft ? 'AI' : 'US') : 'IN'}
                </div>

                <div className="min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate block">
                    {message.from_address}
                  </span>
                  {message.to_addresses && message.to_addresses.length > 0 && (
                    <span className="text-[11px] text-slate-400 truncate block">
                      To: {message.to_addresses.join(', ')}
                    </span>
                  )}
                </div>

                <AuthorBadge
                  authoredBy={message.authored_by}
                  requiresApproval={message.requires_approval}
                />
              </div>

              <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
                {formatMessageDate(message.occurred_at)}
              </span>
            </div>

            {/* Content */}
            {isAiDraft ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>AI Generated Draft Reply:</span>
                </div>
                <AiDraftReview messageId={message.id} initialBody={message.body_text || ''} />
              </div>
            ) : (
              <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {message.body_text || '(no text content)'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
