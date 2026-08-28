import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { MessageList } from './components/message-list'
import { ReplyComposer } from './components/reply-composer'
import { AssociateThread } from './components/associate-thread'
import { ThreadLabels } from './components/thread-labels'
import { getLabels, getLabelAssignmentsForThread } from '@/modules/email-labels/server/repository'
import { getMailboxById } from '@/modules/mailboxes/server/repository'
import { Database } from '@/types/database.types'
import { ArrowLeft, Building2, Mail, Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export default async function ThreadDetailPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  // Explicit tenant scoping on top of RLS
  const { data: thread } = await supabase
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, mailbox_id, contact_id, lead_id,
       contacts ( id, first_name, last_name, email, phone ),
       leads ( id, stage, contacts ( first_name, last_name ) )`
    )
    .eq('id', threadId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!thread) notFound()

  const serviceClient = getServiceClient()

  const [
    { data: mailboxInfo },
    { data: messages },
    { data: allLabels },
    { data: assignmentRows },
  ] = await Promise.all([
    getMailboxById(serviceClient, thread.mailbox_id, tenantId),
    supabase
      .from('email_messages')
      .select('id, direction, from_address, to_addresses, body_text, authored_by, requires_approval, occurred_at, source_message_id, ai_metadata')
      .eq('thread_id', threadId)
      .eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: true, nullsFirst: false }),
    getLabels(supabase, tenantId),
    getLabelAssignmentsForThread(supabase, tenantId, threadId),
  ])

  const assignments = (assignmentRows ?? []).map((a) => {
    const label = a.email_labels as any
    return { id: a.id, label_id: a.label_id, name: label?.name ?? '', color_hex: label?.color_hex ?? '#94a3b8' }
  })

  const brandName = (mailboxInfo as any)?.brands?.name

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Breadcrumbs & Actions Header */}
      <div>
        <Link
          href="/office/email"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-3 group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Inbox</span>
        </Link>

        {/* Main Thread Card Header */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {thread.subject || '(no subject)'}
              </h1>

              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  {mailboxInfo?.mailbox_address || 'Connected Mailbox'}
                </span>

                {brandName && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                    <Building2 className="h-3 w-3 text-slate-400" />
                    {brandName}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  {(thread.participant_addresses ?? []).join(', ')}
                </span>
              </div>
            </div>

            {/* Associate with Contact / Lead */}
            <div className="shrink-0">
              <AssociateThread
                threadId={thread.id}
                contact={thread.contacts as any}
                lead={thread.leads as any}
              />
            </div>
          </div>

          {/* Labels Toolbar */}
          <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-400 mr-1">Labels:</span>
            <ThreadLabels
              threadId={thread.id}
              assignments={assignments}
              availableLabels={allLabels ?? []}
            />
          </div>
        </div>
      </div>

      {/* Message Stream */}
      <div className="space-y-4">
        <MessageList messages={messages ?? []} />
      </div>

      {/* Reply Box */}
      <div className="pt-2">
        <ReplyComposer
          threadId={thread.id}
          mailboxId={thread.mailbox_id}
          mailboxAddress={mailboxInfo?.mailbox_address ?? ''}
          subject={thread.subject ?? ''}
          participantAddresses={thread.participant_addresses ?? []}
        />
      </div>
    </div>
  )
}
