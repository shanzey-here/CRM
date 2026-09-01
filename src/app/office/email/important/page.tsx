import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { ThreadList } from '../components/thread-list'
import { EmailNavigation } from '../components/email-navigation'
import { loadThreadListData, loadEmailChrome } from '../lib/folder-view'
import { getLabels } from '@/modules/email-labels/server/repository'
import { Database } from '@/types/database.types'

export const dynamic = 'force-dynamic'

// Threads are "Important" if they carry one of the tenant's high-signal
// labels: the built-in default "Complaint / Urgent" (every tenant has it) or a
// "VIP Customer" label (a common custom label; tenants without one just get
// the Complaint / Urgent view). Matched by name, case-insensitive — this is a
// filter over the existing label system, not a new schema field.
const IMPORTANT_LABEL_NAMES = new Set(['complaint / urgent', 'vip customer'])

function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export default async function ImportantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const serviceClient = getServiceClient()

  const { data: labels } = await getLabels(supabase, tenantId)
  const importantLabelIds = (labels ?? [])
    .filter((l) => IMPORTANT_LABEL_NAMES.has((l.name ?? '').trim().toLowerCase()))
    .map((l) => l.id)

  let threadIds: string[] = []
  if (importantLabelIds.length > 0) {
    const { data: assignments } = await supabase
      .from('email_label_assignments')
      .select('thread_id')
      .eq('tenant_id', tenantId)
      .in('label_id', importantLabelIds)
    threadIds = [...new Set((assignments ?? []).map((a) => a.thread_id))]
  }

  const [{ threads, allLabels, threadLabels, threadSnippets }, chrome] = await Promise.all([
    loadThreadListData(supabase, tenantId, threadIds),
    loadEmailChrome(supabase, serviceClient, tenantId),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <EmailNavigation pendingReviewCount={chrome.pendingReviewCount} mailboxCount={chrome.mailboxCount} />
      <ThreadList
        threads={threads as any}
        mailboxes={chrome.mailboxes as any}
        allLabels={allLabels}
        threadLabels={threadLabels}
        threadSnippets={threadSnippets}
        basePath="/office/email/important"
      />
    </div>
  )
}
