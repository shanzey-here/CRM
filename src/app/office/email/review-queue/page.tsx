import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { QueueItem } from './components/queue-item'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  // Explicit tenant scoping on top of RLS — this aggregates across a
  // tenant's whole inbox, same defense-in-depth standard as the sibling
  // /office/email inbox page and the Dashboard's cross-module aggregation.
  // created_at, not occurred_at, is the correct "how long pending" column —
  // occurred_at is COALESCE(sent_at, received_at), both NULL for a pending
  // draft.
  const { data: items, count, error } = await supabase
    .from('email_messages')
    .select(
      `id, thread_id, mailbox_id, body_text, created_at, claimed_at, ai_metadata,
       email_threads ( subject, contact_id, mailbox_id,
         contacts ( first_name, last_name ),
         mailboxes ( mailbox_address ) )`,
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .eq('authored_by', 'ai_draft_pending')
    .order('created_at', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Review Queue</h1>
      <p className="text-sm text-slate-500 mb-8">
        AI-drafted replies waiting for your approval, across all connected mailboxes — oldest first.
      </p>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">Failed to load queue: {error.message}</div>}

      {items && items.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg font-medium text-slate-700">You're all caught up</p>
          <p className="text-sm mt-1">No AI-drafted replies are waiting for review.</p>
        </div>
      )}

      <div className="space-y-4">
        {(items ?? []).map((item) => {
          const thread = item.email_threads as any
          const contact = thread?.contacts
          const mailbox = thread?.mailboxes
          const customerName = contact ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}` : null
          const aiMetadata = item.ai_metadata as any
          const computedPrice: number | null = aiMetadata?.computedPrice ?? null

          return (
            <div key={item.id} className="p-4 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {customerName || thread?.subject || 'Unknown customer'}
                    </span>
                    {computedPrice != null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                        Quote — £{Number(computedPrice).toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700">
                        AI draft
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {thread?.subject || '(no subject)'} {mailbox?.mailbox_address ? `· ${mailbox.mailbox_address}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-slate-400">{timeAgo(item.created_at)}</span>
                  <Link href={`/office/email/${item.thread_id}`} className="text-xs text-emerald-600 hover:underline">
                    View full thread
                  </Link>
                </div>
              </div>

              <QueueItem messageId={item.id} initialBody={item.body_text || ''} claimedAt={item.claimed_at} />
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Link
            href={`/office/email/review-queue?page=${Math.max(1, page - 1)}`}
            className={`text-sm ${page <= 1 ? 'text-slate-300 pointer-events-none' : 'text-emerald-600 hover:underline'}`}
          >
            Previous
          </Link>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/office/email/review-queue?page=${Math.min(totalPages, page + 1)}`}
            className={`text-sm ${page >= totalPages ? 'text-slate-300 pointer-events-none' : 'text-emerald-600 hover:underline'}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  )
}
