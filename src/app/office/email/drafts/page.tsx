import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ThreadList } from '../components/thread-list'
import { EmailNavigation } from '../components/email-navigation'
import { loadThreadListData, loadEmailChrome } from '../lib/folder-view'
import { Database } from '@/types/database.types'
import { Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/**
 * Drafts — a familiar, Gmail-style thread-list view of unsent outbound
 * messages. There is no manual-draft feature in this app; the only "not yet
 * sent" state is `email_messages.authored_by = 'ai_draft_pending'`, which is
 * the exact same data the AI Review Queue works from. This tab is NOT a new
 * concept and NOT a rename that hides Review Queue — it's the same rows in a
 * different lens: Review Queue is the approve/edit/discard workflow (plus
 * label suggestions); Drafts is "emails started but not sent" for quick
 * navigation. One source of truth (`authored_by = 'ai_draft_pending'`).
 */
export default async function DraftsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const serviceClient = getServiceClient()

  const { data: draftRows } = await supabase
    .from('email_messages')
    .select('thread_id')
    .eq('tenant_id', tenantId)
    .eq('authored_by', 'ai_draft_pending')

  const threadIds = [...new Set((draftRows ?? []).map((r) => r.thread_id))]

  const [{ threads, allLabels, threadLabels, threadSnippets }, chrome] = await Promise.all([
    loadThreadListData(supabase, tenantId, threadIds),
    loadEmailChrome(supabase, serviceClient, tenantId),
  ])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <EmailNavigation pendingReviewCount={chrome.pendingReviewCount} mailboxCount={chrome.mailboxCount} />

      {threadIds.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>
            These are AI-drafted replies awaiting review.{' '}
            <Link href="/office/email/review-queue" className="font-semibold underline underline-offset-2 hover:text-amber-900">
              Approve or edit them in the Review Queue
            </Link>
            .
          </span>
        </div>
      )}

      <ThreadList
        threads={threads as any}
        mailboxes={chrome.mailboxes as any}
        allLabels={allLabels}
        threadLabels={threadLabels}
        threadSnippets={threadSnippets}
        basePath="/office/email/drafts"
      />
    </div>
  )
}
