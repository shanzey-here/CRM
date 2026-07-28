import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// Single canonical read path for a tenant's current entitlements. Future
// limit checks (and the plan-limits branch) should call this rather than
// querying saas_plans/saas_prices/tenant_subscriptions directly — keeps
// entitlement resolution in one place instead of scattered joins.
//
// Deliberately does NOT react to tenant_subscriptions.status (e.g. does not
// return {} just because status is 'past_due') — status is a signal for a
// future gating/enforcement layer to consult if it chooses to, not something
// this helper itself enforces. No limits are enforced here, only resolved.
export async function getTenantEntitlements(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select('saas_prices ( saas_plans ( entitlements ) )')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) {
    return {}
  }

  const entitlements = (data as any).saas_prices?.saas_plans?.entitlements

  return entitlements && typeof entitlements === 'object' ? entitlements : {}
}

export type LimitKey = 'max_users' | 'max_leads'

export async function checkTenantLimit(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  limitKey: LimitKey
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const entitlements = await getTenantEntitlements(supabase, tenantId)
  const limitValue = entitlements[limitKey]

  // If no limit is defined on the plan, allow by default
  if (typeof limitValue !== 'number') {
    return { allowed: true, limit: null, current: 0 }
  }

  let current = 0

  if (limitKey === 'max_users') {
    // Only count active users (exclude deactivated staff so they aren't stuck at a historical high-water mark)
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
    current = count ?? 0
  } else if (limitKey === 'max_leads') {
    // Exclude archived leads
    const { count } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_archived', false)
    current = count ?? 0
  }

  return {
    allowed: current < limitValue,
    limit: limitValue,
    current
  }
}
