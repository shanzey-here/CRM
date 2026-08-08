import { User, Bot, Clock } from 'lucide-react'
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
}

// Explicit branch per known authored_by value plus a default fallback —
// not a bare switch that silently renders nothing. A future value from
// ai-email-draft (there are only three today: human/ai_draft_pending/
// ai_sent, all NOT NULL at the DB level, so there's no null case) will
// render as an unrecognized-but-visible badge rather than breaking the row.
function AuthorBadge({ authoredBy, requiresApproval }: { authoredBy: string; requiresApproval: boolean }) {
  if (authoredBy === 'human') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
        <User className="h-2.5 w-2.5" /> Human
      </span>
    )
  }
  if (authoredBy === 'ai_sent') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
        <Bot className="h-2.5 w-2.5" /> AI sent
      </span>
    )
  }
  if (authoredBy === 'ai_draft_pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
        <Clock className="h-2.5 w-2.5" /> {requiresApproval ? 'AI draft — awaiting approval' : 'AI draft'}
      </span>
    )
  }
  // Forward-compat fallback for any future authored_by value this UI
  // doesn't know about yet — visible and honest, not blank.
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
      {authoredBy}
    </span>
  )
}

export function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return <div className="text-sm text-slate-500 py-8 text-center">No messages in this thread yet.</div>
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isOutbound = message.direction === 'outbound'
        return (
          <div
            key={message.id}
            className={`p-4 rounded-lg border ${isOutbound ? 'bg-emerald-50/50 border-emerald-100 ml-8' : 'bg-white border-slate-200 mr-8'}`}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-slate-900 truncate">{message.from_address}</span>
                <AuthorBadge authoredBy={message.authored_by} requiresApproval={message.requires_approval} />
              </div>
              <span className="text-[11px] text-slate-400 shrink-0">
                {message.occurred_at ? new Date(message.occurred_at).toLocaleString('en-GB') : 'not yet sent'}
              </span>
            </div>
            {message.authored_by === 'ai_draft_pending' ? (
              <AiDraftReview messageId={message.id} initialBody={message.body_text || ''} />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{message.body_text || '(no text content)'}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
