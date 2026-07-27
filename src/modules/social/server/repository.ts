import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getTenantEntitlements } from '@/modules/subscriptions/server/entitlements'

export async function isSocialModuleEnabled(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<boolean> {
  // 1. Check if the subscription plan includes the social_media entitlement
  const entitlements = await getTenantEntitlements(supabase, tenantId)
  if (entitlements.social_media !== true) {
    return false
  }

  // 2. Check if the tenant has explicitly enabled the module
  const { data, error } = await supabase
    .from('tenant_modules')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_key', 'social_media')
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return data.enabled
}

type ConnectedSocialAccount = Database['public']['Tables']['connected_social_accounts']['Row']

// Explicit tenant scoping on every query in this file — a publish call
// must only ever operate on the calling tenant's own connected accounts.
export async function getConnectedAccounts(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  accountIds: string[]
): Promise<ConnectedSocialAccount[]> {
  const { data, error } = await supabase
    .from('connected_social_accounts')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('id', accountIds)
    .eq('is_active', true)

  if (error) {
    console.error('[social] Failed to load connected accounts:', error.message)
    return []
  }
  return data ?? []
}

// Mirrors markMailboxSyncFailure's exact pattern (src/modules/mailboxes/server/repository.ts)
// — mark inactive with a clear stored context, no silent retry loop. There
// is no last_sync_error-equivalent column on connected_social_accounts
// today; logged server-side instead, matching this branch's scope (schema
// changes beyond what's already agreed are out of scope here).
export async function markAccountInactive(supabase: SupabaseClient<Database>, tenantId: string, accountId: string, reason: string) {
  console.error(`[social] Marking account ${accountId} (tenant ${tenantId}) inactive: ${reason}`)
  await supabase
    .from('connected_social_accounts')
    .update({ is_active: false })
    .eq('id', accountId)
    .eq('tenant_id', tenantId)
}

export async function getOrCreateAggregatorProfileId(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ profileId: string } | { error: string }> {
  const { data: settings, error: readErr } = await supabase
    .from('tenant_settings')
    .select('social_aggregator_profile_id')
    .eq('tenant_id', tenantId)
    .single()

  if (readErr) return { error: readErr.message }
  if (settings.social_aggregator_profile_id) return { profileId: settings.social_aggregator_profile_id }

  const { createZernioProfile } = await import('../provider/zernio')
  const result = await createZernioProfile(`tenant-${tenantId}`)
  if (!result.ok) return { error: result.error }

  const { error: writeErr } = await supabase
    .from('tenant_settings')
    .update({ social_aggregator_profile_id: result.profileId })
    .eq('tenant_id', tenantId)

  if (writeErr) return { error: writeErr.message }
  return { profileId: result.profileId }
}

// Re-syncs connected_social_accounts from Zernio's own account list for a
// profile — the source of truth — rather than trusting whatever query
// params Zernio's hosted connect flow appends to the final redirect
// (never confirmed via a real click-through; the plan explicitly flagged
// this as unverified). Upserts every account Zernio reports for the
// profile, including reactivating one that was previously marked
// inactive and has since been reconnected.
export async function syncConnectedAccountsFromAggregator(supabase: SupabaseClient<Database>, tenantId: string, profileId: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const { listConnectedAccounts } = await import('../provider/zernio')
  const result = await listConnectedAccounts(profileId)
  if (!result.ok) return { ok: false, error: result.error }

  for (const account of result.accounts) {
    await createConnectedAccount(supabase, tenantId, {
      platform: account.platform,
      aggregatorAccountId: account.id,
      displayName: account.displayName,
    })
  }
  return { ok: true, count: result.accounts.length }
}

export async function createConnectedAccount(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: { platform: string; aggregatorAccountId: string; displayName: string }
) {
  return supabase
    .from('connected_social_accounts')
    .upsert(
      {
        tenant_id: tenantId,
        platform: input.platform,
        aggregator_profile_id: input.aggregatorAccountId,
        display_name: input.displayName,
        is_active: true,
      },
      { onConflict: 'tenant_id,platform,aggregator_profile_id' }
    )
    .select()
    .single()
}
