import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getSocialAdapter } from '../provider'
import { isSocialModuleEnabled, getConnectedAccounts, markAccountInactive, getOrCreateAggregatorProfileId } from './repository'

export type PublishBatchResult = {
  accountId: string
  ok: boolean
  postId?: string
  platformPostUrl?: string | null
  error?: string
}

// Per-account failure isolation, not all-or-nothing — same principle as
// the mailbox sync worker's per-mailbox isolation
// (src/modules/mailboxes/server/sync.ts's runMailboxSync() loop). A
// broken/revoked connection for one account must never abort publishing
// to the tenant's other connected accounts, and always returns a result
// for every requested account, never throws on a partial failure.
export async function publishToAccounts(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  { accountIds, content, mediaUrls }: { accountIds: string[]; content: string; mediaUrls?: string[] }
): Promise<PublishBatchResult[]> {
  if (!(await isSocialModuleEnabled(supabase, tenantId))) {
    return accountIds.map((accountId) => ({ accountId, ok: false, error: 'Social module is not enabled for this tenant' }))
  }

  // Explicit tenant scoping — an accountId belonging to another tenant
  // simply won't come back from this query, never silently published to.
  const accounts = await getConnectedAccounts(supabase, tenantId, accountIds)
  const foundIds = new Set(accounts.map((a) => a.id))

  const profileResult = await getOrCreateAggregatorProfileId(supabase, tenantId)
  if ('error' in profileResult) {
    return accountIds.map((accountId) => ({ accountId, ok: false, error: `Failed to resolve aggregator profile: ${profileResult.error}` }))
  }
  const aggregatorProfileId = profileResult.profileId

  const adapter = getSocialAdapter()
  const results: PublishBatchResult[] = []

  for (const accountId of accountIds) {
    const account = accounts.find((a) => a.id === accountId)
    if (!account) {
      // Either not found, not this tenant's, or inactive — never
      // distinguished in the response (don't leak cross-tenant existence).
      results.push({ accountId, ok: false, error: 'Account not found or not active for this tenant' })
      continue
    }

    try {
      const result = await adapter.publishPost({
        aggregatorProfileId,
        platform: account.platform,
        accountId: account.aggregator_profile_id,
        content,
        mediaUrls,
      })

      if (result.ok) {
        results.push({ accountId, ok: true, postId: result.postId, platformPostUrl: result.platformPostUrl })
      } else {
        if (result.brokenConnection) {
          await markAccountInactive(supabase, tenantId, accountId, result.error)
        }
        results.push({ accountId, ok: false, error: result.error })
      }
    } catch (err) {
      // A thrown error from one account's publish attempt must never abort
      // the loop — caught here, recorded, move to the next account.
      const message = err instanceof Error ? err.message : 'Unknown publish error'
      console.error(`[social] publishPost threw for account ${accountId}:`, err)
      results.push({ accountId, ok: false, error: message })
    }
  }

  return results
}
