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
