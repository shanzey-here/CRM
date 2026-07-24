import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

export default async function AutoSentLogPage({
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

  // Explicit tenant scoping, same defense-in-depth standard as every other
  // cross-thread aggregation in this project (review-queue, the inbox
  // list). ai_metadata->>autoSent = 'true' is a precise, mode-agnostic
  // marker for "this went out with zero human review" — set in
  // orchestrate.ts's outcome.autoSend branch, which both auto_send mode
  // and assist mode's routine-reply path share. Filtering on it (rather
  // than on the tenant's CURRENT mode) means a routine assist auto-send
  // shows up here too, not just literal auto_send-mode output.
  const { data: items, count, error } = await supabase
    .from('email_messages')
    .select(
      `id, thread_id, mailbox_id, body_text, sent_at, ai_metadata,
       email_threads ( subject, contact_id,
         contacts ( first_name, last_name ),
         mailboxes ( mailbox_address ) )`,
      { count: 'exact' }
    )
    .eq('tenant_id', tenantId)
    .eq('authored_by', 'ai_sent')
    .not('ai_metadata->>autoSent', 'is', null)
    .order('sent_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Recently Auto-Sent</h1>
      <p className="text-sm text-slate-500 mb-8">
        Every AI reply that went out with no human review — across every mode that can auto-send, not just
        Fully Automatic. Read-only: there's nothing to approve here, it's already been sent.
      </p>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">Failed to load log: {error.message}</div>}

      {items && items.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <p className="text-lg font-medium text-slate-700">Nothing auto-sent yet</p>
          <p className="text-sm mt-1">Replies sent automatically, with no review step, will appear here.</p>
        </div>
      )}

      <div className="space-y-3">
        {(items ?? []).map((item) => {
          const thread = item.email_threads as any
          const contact = thread?.contacts
          const mailbox = thread?.mailboxes
          const customerName = contact ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}` : null
          const aiMetadata = item.ai_metadata as any
          const computedPrice: number | null = aiMetadata?.computedPrice ?? null

          return (
            <div key={item.id} className="p-4 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {customerName || thread?.subject || 'Unknown customer'}
                    </span>
                    {computedPrice != null ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-700">
                        Quote — £{Number(computedPrice).toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700">
                        AI sent
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {thread?.subject || '(no subject)'} {mailbox?.mailbox_address ? `· ${mailbox.mailbox_address}` : ''}
                  </p>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{item.body_text}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[11px] text-slate-400">{item.sent_at ? timeAgo(item.sent_at) : ''}</span>
                  <Link href={`/office/email/${item.thread_id}`} className="text-xs text-emerald-600 hover:underline whitespace-nowrap">
                    View full thread
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <Link
            href={`/office/email/auto-sent-log?page=${Math.max(1, page - 1)}`}
            className={`text-sm ${page <= 1 ? 'text-slate-300 pointer-events-none' : 'text-emerald-600 hover:underline'}`}
          >
            Previous
          </Link>
          <span className="text-xs text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/office/email/auto-sent-log?page=${Math.min(totalPages, page + 1)}`}
            className={`text-sm ${page >= totalPages ? 'text-slate-300 pointer-events-none' : 'text-emerald-600 hover:underline'}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  )
}
