import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ThreadList } from './components/thread-list'

export const dynamic = 'force-dynamic'

export default async function EmailInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ mailbox?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  // Explicit tenant scoping on every query in this page, on top of RLS —
  // this page aggregates across all of a tenant's mailboxes, same
  // defense-in-depth standard as the Dashboard's cross-module aggregation.
  const { data: mailboxes } = await supabase
    .from('mailboxes')
    .select('id, mailbox_address, provider')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  let threadQuery = supabase
    .from('email_threads')
    .select(
      `id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
       contacts:contact_id ( first_name, last_name ),
       leads:lead_id ( contact_id, contacts:contact_id ( first_name, last_name ) )`
    )
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (params.mailbox) {
    threadQuery = threadQuery.eq('mailbox_id', params.mailbox).eq('tenant_id', tenantId)
  }

  const { data: threads, error } = await threadQuery

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Email</h1>
      <p className="text-sm text-slate-500 mb-8">
        Threads across your connected mailboxes.{' '}
        {mailboxes && mailboxes.length === 0 && (
          <a href="/office/settings/mailboxes" className="text-emerald-600 hover:underline">
            Connect a mailbox to get started.
          </a>
        )}
      </p>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">Failed to load threads: {error.message}</div>}

      <ThreadList threads={(threads as any) ?? []} mailboxes={mailboxes ?? []} activeMailboxId={params.mailbox} />
    </div>
  )
}
