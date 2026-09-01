import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { ThreadList } from '../components/thread-list'
import { EmailNavigation } from '../components/email-navigation'
import { loadThreadListData, loadEmailChrome } from '../lib/folder-view'
import { Database } from '@/types/database.types'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Sent — every message this app has genuinely sent: manual staff replies
 * (authored_by = 'human'), AI auto-sent replies and approved-then-sent AI
 * drafts (authored_by = 'ai_sent'). The single distinguishing fact is
 * `direction = 'outbound' AND sent_at IS NOT NULL` — which excludes the
 * unsent 'ai_draft_pending' rows (those are the Drafts / Review Queue).
 */
export default async function SentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const serviceClient = getServiceClient()

  const { data: sentRows } = await supabase
    .from('email_messages')
    .select('thread_id')
    .eq('tenant_id', tenantId)
    .eq('direction', 'outbound')
    .not('sent_at', 'is', null)

  const threadIds = [...new Set((sentRows ?? []).map((r) => r.thread_id))]

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
        basePath="/office/email/sent"
      />
    </div>
  )
}
