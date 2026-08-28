import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { ThreadList } from './components/thread-list'
import { EmailNavigation } from './components/email-navigation'
import { getLabels, getLabelAssignmentsForThreads, getPendingLabelSuggestions } from '@/modules/email-labels/server/repository'
import { getTenantMailboxes } from '@/modules/mailboxes/server/repository'
import { Database } from '@/types/database.types'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function EmailInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ mailbox?: string; labels?: string; q?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const activeLabelIds = params.labels ? params.labels.split(',').filter(Boolean) : []
  const serviceClient = getServiceClient()

  // Explicit tenant scoping across all queries
  const [
    { data: mailboxes },
    { count: pendingDraftsCount },
    { data: pendingSuggestions },
  ] = await Promise.all([
    getTenantMailboxes(serviceClient, tenantId),
    serviceClient
      .from('email_messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('authored_by', 'ai_draft_pending'),
    getPendingLabelSuggestions(supabase, tenantId),
  ])

  const totalPendingReview = (pendingDraftsCount ?? 0) + (pendingSuggestions?.length ?? 0)

  // Query threads without embedded mailboxes join to avoid PostgREST column-level permission restrictions
  let threadQuery = supabase
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
       contacts ( id, first_name, last_name, email ),
       leads ( id, stage, contact_id, contacts ( first_name, last_name ) )`
    )
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (params.mailbox) {
    threadQuery = threadQuery.eq('mailbox_id', params.mailbox)
  }

  const { data: threads, error } = await threadQuery
  const threadIds = (threads ?? []).map((t) => t.id)

  const [{ data: allLabels }, { data: assignments }, { data: recentMessages }] = await Promise.all([
    getLabels(supabase, tenantId),
    getLabelAssignmentsForThreads(supabase, tenantId, threadIds),
    threadIds.length > 0
      ? supabase
          .from('email_messages')
          .select('thread_id, body_text, from_address, direction, occurred_at, authored_by')
          .eq('tenant_id', tenantId)
          .in('thread_id', threadIds)
          .order('occurred_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])

  // Build mailbox lookup map
  const mailboxMap = new Map((mailboxes ?? []).map((m) => [m.id, m]))

  // Attach mailbox metadata to threads
  const enrichedThreads = (threads ?? []).map((t) => ({
    ...t,
    mailboxes: mailboxMap.get(t.mailbox_id) ?? null,
  }))

  // Build snippet preview map
  const threadSnippets: Record<string, { body: string; from: string; direction: string; authored_by: string }> = {}
  for (const m of recentMessages ?? []) {
    if (!threadSnippets[m.thread_id]) {
      threadSnippets[m.thread_id] = {
        body: m.body_text || '',
        from: m.from_address || '',
        direction: m.direction || 'inbound',
        authored_by: m.authored_by || 'human',
      }
    }
  }

  const threadLabels: Record<string, { id: string; name: string; color_hex: string }[]> = {}
  for (const a of assignments ?? []) {
    const label = a.email_labels as any
    if (!label) continue
    if (!threadLabels[a.thread_id]) threadLabels[a.thread_id] = []
    threadLabels[a.thread_id].push({ id: label.id, name: label.name, color_hex: label.color_hex })
  }

  const visibleThreads =
    activeLabelIds.length === 0
      ? enrichedThreads
      : enrichedThreads.filter((t) => (threadLabels[t.id] ?? []).some((l) => activeLabelIds.includes(l.id)))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <EmailNavigation
        pendingReviewCount={totalPendingReview}
        mailboxCount={mailboxes?.length ?? 0}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          Failed to load threads: {error.message}
        </div>
      )}

      <ThreadList
        threads={(visibleThreads as any) ?? []}
        mailboxes={(mailboxes as any) ?? []}
        activeMailboxId={params.mailbox}
        allLabels={allLabels ?? []}
        threadLabels={threadLabels}
        threadSnippets={threadSnippets}
        activeLabelIds={activeLabelIds}
      />
    </div>
  )
}
