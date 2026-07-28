import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { publishToAccounts, PublishBatchResult } from './publish'

type ScheduledPostRow = Database['public']['Tables']['scheduled_posts']['Row']

// Never modifies publishToAccounts()'s per-account isolation — this only
// summarizes its already-isolated results into one row-level status for
// the history list. The full per-account detail is always kept in
// publish_results, regardless of which summary status is chosen.
async function publishClaimedPost(supabase: SupabaseClient<Database>, post: ScheduledPostRow): Promise<PublishBatchResult[]> {
  const results = await publishToAccounts(supabase, post.tenant_id, {
    accountIds: post.account_ids,
    content: post.content,
  })

  const succeeded = results.filter((r) => r.ok).length
  const status = succeeded === results.length ? 'published' : succeeded === 0 ? 'failed' : 'partial'

  await supabase.from('scheduled_posts').update({ status, publish_results: results as any }).eq('id', post.id)

  return results
}

// "Post now" path — single-row atomic claim, same guard shape as
// approveAiDraftAction (src/app/office/email/[threadId]/actions.ts): the
// UPDATE only ever matches for one caller, so this can never publish the
// same post twice even if called concurrently for the same id.
export async function publishNow(supabase: SupabaseClient<Database>, tenantId: string, postId: string): Promise<PublishBatchResult[] | null> {
  const { data: claimed } = await supabase
    .from('scheduled_posts')
    .update({ claimed_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .is('claimed_at', null)
    .select()
    .maybeSingle()

  if (!claimed) return null
  return publishClaimedPost(supabase, claimed)
}

// Cron sweep — claims every currently-due row across all tenants in one
// atomic statement (the set-based generalization of the same claim
// guard), then processes each with the same per-account-isolated
// publishToAccounts() call. Two overlapping sweeps can't both claim the
// same row for the same reason two overlapping single-row claims can't:
// Postgres serializes the writes, and the loser's WHERE (claimed_at IS
// NULL) matches nothing once the winner's claim has committed.
export async function sweepDuePosts(serviceClient: SupabaseClient<Database>): Promise<{ processed: number; results: { postId: string; results: PublishBatchResult[] }[] }> {
  const nowIso = new Date().toISOString()

  const { data: claimed } = await serviceClient
    .from('scheduled_posts')
    .update({ claimed_at: nowIso })
    .eq('status', 'pending')
    .is('claimed_at', null)
    .lte('scheduled_for', nowIso)
    .select()

  const rows = claimed ?? []
  const results: { postId: string; results: PublishBatchResult[] }[] = []

  // Sequential, not parallel — same pacing rationale as runMailboxSync's
  // per-mailbox loop.
  for (const post of rows) {
    const postResults = await publishClaimedPost(serviceClient, post)
    results.push({ postId: post.id, results: postResults })
  }

  return { processed: rows.length, results }
}

// Cancel — same claimed_at-guard reasoning as discardAiDraftAction: a
// post that's already been claimed (either published synchronously via
// "post now" or picked up by a sweep) can never be cancelled out from
// under that in-flight publish.
export async function cancelScheduledPost(supabase: SupabaseClient<Database>, tenantId: string, postId: string) {
  return supabase
    .from('scheduled_posts')
    .update({ status: 'cancelled' })
    .eq('id', postId)
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .is('claimed_at', null)
    .select()
    .maybeSingle()
}
