import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import {
  getLabels,
  getLabelAssignmentsForThreads,
  getPendingLabelSuggestions,
} from '@/modules/email-labels/server/repository'
import { getTenantMailboxes } from '@/modules/mailboxes/server/repository'

type Client = SupabaseClient<Database>

/**
 * Everything the shared <ThreadList> needs to render a set of threads, built
 * exactly the way the Inbox page builds it (same helper functions, same
 * snippet/label shaping) — so the Sent / Drafts / Important folder tabs are a
 * different WHERE clause over the same data, not a parallel implementation.
 *
 * `threadIds` is the already-selected, tenant-scoped set for this folder.
 * Every query here is additionally `.eq('tenant_id', tenantId)` and runs on
 * the caller's RLS'd client.
 */
export async function loadThreadListData(supabase: Client, tenantId: string, threadIds: string[]) {
  if (threadIds.length === 0) {
    return { threads: [] as any[], allLabels: [] as any[], threadLabels: {} as Record<string, { id: string; name: string; color_hex: string }[]>, threadSnippets: {} as Record<string, { body: string; from: string; direction: string; authored_by: string }> }
  }

  const [{ data: threads }, { data: allLabels }, { data: assignments }, { data: recentMessages }] =
    await Promise.all([
      supabase
        .from('email_threads')
        .select(
          `id, subject, participant_addresses, last_message_at, mailbox_id, contact_id, lead_id,
           contacts ( id, first_name, last_name, email ),
           leads ( id, stage, contact_id, contacts ( first_name, last_name ) )`,
        )
        .eq('tenant_id', tenantId)
        .in('id', threadIds)
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      getLabels(supabase, tenantId),
      getLabelAssignmentsForThreads(supabase, tenantId, threadIds),
      supabase
        .from('email_messages')
        .select('thread_id, body_text, from_address, direction, occurred_at, authored_by')
        .eq('tenant_id', tenantId)
        .in('thread_id', threadIds)
        .order('occurred_at', { ascending: false }),
    ])

  const threadSnippets: Record<
    string,
    { body: string; from: string; direction: string; authored_by: string }
  > = {}
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

  return { threads: (threads ?? []) as any[], allLabels: (allLabels ?? []) as any[], threadLabels, threadSnippets }
}

/**
 * The page chrome shared by every Email tab: the mailbox list (+ count) and
 * the Review Queue pending badge. Same computation the Inbox / Review Queue /
 * Auto-Sent Log pages already do.
 */
export async function loadEmailChrome(supabase: Client, serviceClient: Client, tenantId: string) {
  const [{ data: mailboxes }, { count: pendingDraftsCount }, { data: pendingSuggestions }] =
    await Promise.all([
      getTenantMailboxes(serviceClient, tenantId),
      serviceClient
        .from('email_messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('authored_by', 'ai_draft_pending'),
      getPendingLabelSuggestions(supabase, tenantId),
    ])

  return {
    mailboxes: mailboxes ?? [],
    mailboxCount: mailboxes?.length ?? 0,
    pendingReviewCount: (pendingDraftsCount ?? 0) + (pendingSuggestions?.length ?? 0),
  }
}
