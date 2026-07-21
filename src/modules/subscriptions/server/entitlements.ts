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
