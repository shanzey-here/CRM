import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { QueueItem } from './components/queue-item'
import { LabelSuggestionQueueItem } from './components/label-suggestion-queue-item'
import { getPendingLabelSuggestions } from '@/modules/email-labels/server/repository'
import { getTenantMailboxes } from '@/modules/mailboxes/server/repository'
import { LabelChip } from '@/modules/email-labels/components/label-chip'
import { EmailNavigation } from '../components/email-navigation'
import { Database } from '@/types/database.types'
import { CheckCircle2, Clock, Sparkles, User, Mail, ArrowRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

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

  const serviceClient = getServiceClient()

  const [
    { data: mailboxes },
    { data: items, count, error },
    { data: labelSuggestions },
  ] = await Promise.all([
    getTenantMailboxes(serviceClient, tenantId),
    supabase
      .from('email_messages')
      .select(
        `id, thread_id, mailbox_id, body_text, created_at, claimed_at, ai_metadata,
         email_threads ( subject, contact_id, mailbox_id,
           contacts ( first_name, last_name ) )`,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId)
      .eq('authored_by', 'ai_draft_pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1),
    getPendingLabelSuggestions(supabase, tenantId),
  ])

  const mailboxMap = new Map((mailboxes ?? []).map((m) => [m.id, m]))
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1
  const totalPending = (count ?? 0) + (labelSuggestions?.length ?? 0)

  type QueueEntry =
    | { type: 'draft'; timestamp: string; item: (typeof items extends (infer T)[] | null ? T : never) }
    | { type: 'label_suggestion'; timestamp: string; item: NonNullable<typeof labelSuggestions>[number] }

  const draftEntries: QueueEntry[] = (items ?? []).map((item) => ({ type: 'draft', timestamp: item.created_at, item }))
  const labelEntries: QueueEntry[] = (labelSuggestions ?? []).map((item) => ({
    type: 'label_suggestion',
    timestamp: item.suggested_at,
    item,
  }))
  const queueEntries = [...draftEntries, ...labelEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <EmailNavigation
        pendingReviewCount={totalPending}
        mailboxCount={mailboxes?.length ?? 0}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to load queue: {error.message}
        </div>
      )}

      {queueEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">You're all caught up!</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            No AI-drafted replies or label suggestions are waiting for review. When new customer inquiries arrive, drafts will appear here for one-click approval.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/office/email"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Mail className="h-3.5 w-3.5" />
              View Inbox
            </Link>
            <Link
              href="/office/settings/ai-assistant"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              AI Trust Settings
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-slate-500">
              Showing <span className="font-semibold text-slate-700">{queueEntries.length}</span> pending item(s) (oldest first)
            </p>
            <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/80 font-medium inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Review required before sending
            </span>
          </div>

          <div className="space-y-4">
            {queueEntries.map((entry) => {
              if (entry.type === 'draft') {
                const item = entry.item
                const thread = item.email_threads as any
                const contact = thread?.contacts
                const mailbox = mailboxMap.get(item.mailbox_id)
                const customerName = contact ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}` : null
                const aiMetadata = item.ai_metadata as any
                const computedPrice: number | null = aiMetadata?.computedPrice ?? null

                return (
                  <div key={`draft-${item.id}`} className="p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {customerName || thread?.subject || 'Customer Inquiry'}
                          </span>
                          {computedPrice != null ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <Sparkles className="h-3 w-3 text-emerald-600" />
                              Calculated Quote: £{Number(computedPrice).toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/80">
                              <Clock className="h-3 w-3 text-amber-600" />
                              AI Draft Reply
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          <span className="font-medium text-slate-700">{thread?.subject || '(no subject)'}</span>
                          {mailbox?.mailbox_address ? ` · ${mailbox.mailbox_address}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-400">{timeAgo(item.created_at)}</span>
                        <Link
                          href={`/office/email/${item.thread_id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          <span>Full thread</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>

                    <QueueItem messageId={item.id} initialBody={item.body_text || ''} claimedAt={item.claimed_at} />
                  </div>
                )
              }

              // type === 'label_suggestion'
              const item = entry.item
              const thread = item.email_threads as any
              const label = item.email_labels as any
              const contact = thread?.contacts
              const mailbox = mailboxMap.get(thread?.mailbox_id)
              const customerName = contact ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}` : null

              return (
                <div key={`label-${item.id}`} className="p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {customerName || thread?.subject || 'Customer Inquiry'}
                        </span>
                        {label && (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-xs text-slate-400 mr-0.5">Suggested label:</span>
                            <LabelChip
                              name={label.name}
                              colorHex={label.color_hex}
                              variant="solid"
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        <span className="font-medium text-slate-700">{thread?.subject || '(no subject)'}</span>
                        {mailbox?.mailbox_address ? ` · ${mailbox.mailbox_address}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400">{timeAgo(item.suggested_at)}</span>
                      <Link
                        href={`/office/email/${item.thread_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        <span>Full thread</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  <LabelSuggestionQueueItem suggestionId={item.id} threadId={item.thread_id} labelId={item.label_id} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <Link
            href={`/office/email/review-queue?page=${Math.max(1, page - 1)}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              page <= 1 ? 'text-slate-300 border-slate-100 pointer-events-none' : 'text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            &larr; Previous
          </Link>
          <span className="text-xs text-slate-500">
            Page <span className="font-semibold text-slate-800">{page}</span> of {totalPages}
          </span>
          <Link
            href={`/office/email/review-queue?page=${Math.min(totalPages, page + 1)}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              page >= totalPages ? 'text-slate-300 border-slate-100 pointer-events-none' : 'text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Next &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}
