import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { MessageList } from './components/message-list'
import { ReplyComposer } from './components/reply-composer'
import { AssociateThread } from './components/associate-thread'
import { ThreadLabels } from './components/thread-labels'
import { getLabels, getLabelAssignmentsForThread } from '@/modules/email-labels/server/repository'

export const dynamic = 'force-dynamic'

export default async function ThreadDetailPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  // Explicit tenant scoping on top of RLS.
  const { data: thread } = await supabase
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, mailbox_id, contact_id, lead_id,
       mailboxes ( id, mailbox_address, provider ),
       contacts ( id, first_name, last_name )`
    )
    .eq('id', threadId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!thread) notFound()

  const { data: messages } = await supabase
    .from('email_messages')
    .select('id, direction, from_address, to_addresses, body_text, authored_by, requires_approval, occurred_at, source_message_id')
    .eq('thread_id', threadId)
    .eq('tenant_id', tenantId)
    .order('occurred_at', { ascending: true, nullsFirst: false })

  const [{ data: allLabels }, { data: assignmentRows }] = await Promise.all([
    getLabels(supabase, tenantId),
    getLabelAssignmentsForThread(supabase, tenantId, threadId),
  ])

  const assignments = (assignmentRows ?? []).map((a) => {
    const label = a.email_labels as any
    return { id: a.id, label_id: a.label_id, name: label?.name ?? '', color_hex: label?.color_hex ?? '#94a3b8' }
  })

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <a href="/office/email" className="text-xs text-slate-500 hover:text-slate-700">&larr; Back to Email</a>
        <h1 className="text-xl font-bold text-slate-900 mt-1">{thread.subject || '(no subject)'}</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {(thread.mailboxes as any)?.mailbox_address} · {(thread.participant_addresses ?? []).join(', ')}
        </p>
        <div className="mt-3">
          <ThreadLabels threadId={thread.id} assignments={assignments} availableLabels={allLabels ?? []} />
        </div>
      </div>

      <AssociateThread threadId={thread.id} contact={thread.contacts as any} />

      <div className="mt-6">
        <MessageList messages={messages ?? []} />
      </div>

      <div className="mt-6">
        <ReplyComposer
          threadId={thread.id}
          mailboxId={thread.mailbox_id}
          mailboxAddress={(thread.mailboxes as any)?.mailbox_address ?? ''}
          subject={thread.subject ?? ''}
          participantAddresses={thread.participant_addresses ?? []}
        />
      </div>
    </div>
  )
}
