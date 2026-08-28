import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { EmailNavigation } from '../components/email-navigation'
import { getPendingLabelSuggestions } from '@/modules/email-labels/server/repository'
import { getTenantMailboxes } from '@/modules/mailboxes/server/repository'
import { Database } from '@/types/database.types'
import { Send, Sparkles, CheckCircle2, ArrowRight, ShieldCheck, Mail } from 'lucide-react'

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

  const serviceClient = getServiceClient()

  const [
    { data: mailboxes },
    { count: pendingDraftsCount },
    { data: pendingSuggestions },
    { data: items, count, error },
  ] = await Promise.all([
    getTenantMailboxes(serviceClient, tenantId),
    serviceClient
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('authored_by', 'ai_draft_pending'),
    getPendingLabelSuggestions(supabase, tenantId),
    supabase
      .from('email_messages')
      .select(
        `id, thread_id, mailbox_id, body_text, sent_at, ai_metadata,
         email_threads ( subject, contact_id,
           contacts ( first_name, last_name ) )`,
        { count: 'exact' }
      )
      .eq('tenant_id', tenantId)
      .eq('authored_by', 'ai_sent')
      .not('ai_metadata->>autoSent', 'is', null)
      .order('sent_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1),
  ])

  const mailboxMap = new Map((mailboxes ?? []).map((m) => [m.id, m]))
  const totalPending = (pendingDraftsCount ?? 0) + (pendingSuggestions?.length ?? 0)
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <EmailNavigation
        pendingReviewCount={totalPending}
        mailboxCount={mailboxes?.length ?? 0}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Failed to load log: {error.message}
        </div>
      )}

      {items && items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Send className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Nothing auto-sent yet</h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Replies sent automatically by AI without human review will appear in this audit log.
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
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              AI Trust Settings
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-slate-500">
              Audit log of <span className="font-semibold text-slate-700">{count ?? 0}</span> autonomously delivered replies
            </p>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80 font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Live dispatched
            </span>
          </div>

          <div className="space-y-3">
            {(items ?? []).map((item) => {
              const thread = item.email_threads as any
              const contact = thread?.contacts
              const mailbox = mailboxMap.get(item.mailbox_id)
              const customerName = contact ? `${contact.first_name}${contact.last_name ? ` ${contact.last_name}` : ''}` : null
              const aiMetadata = item.ai_metadata as any
              const computedPrice: number | null = aiMetadata?.computedPrice ?? null

              return (
                <div
                  key={item.id}
                  className="p-5 rounded-xl border border-slate-200/80 bg-white shadow-xs hover:border-slate-300 transition-all space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {customerName || thread?.subject || 'Customer'}
                        </span>
                        {computedPrice != null ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                            <Sparkles className="h-3 w-3 text-emerald-600" />
                            Priced Quote: £{Number(computedPrice).toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200/80">
                            <Send className="h-3 w-3 text-blue-600" />
                            AI Autonomous Reply
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 truncate">
                        <span className="font-medium text-slate-700">{thread?.subject || '(no subject)'}</span>
                        {mailbox?.mailbox_address ? ` · ${mailbox.mailbox_address}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-slate-400">{item.sent_at ? timeAgo(item.sent_at) : ''}</span>
                      <Link
                        href={`/office/email/${item.thread_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                      >
                        <span>Full thread</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-lg text-xs text-slate-700 whitespace-pre-wrap line-clamp-3">
                    {item.body_text}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
          <Link
            href={`/office/email/auto-sent-log?page=${Math.max(1, page - 1)}`}
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
            href={`/office/email/auto-sent-log?page=${Math.min(totalPages, page + 1)}`}
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
