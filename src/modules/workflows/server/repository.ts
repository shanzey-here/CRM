import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getTenantEntitlements } from '@/modules/subscriptions/server/entitlements'

// Note: If a tenant's AI quoting mode is set to assist/auto_send/quote_review,
// and they also build a workflow triggered on 'email.received', both systems
// will react independently to the same event. This is a known interaction
// that will need to be designed around in the builder UI and execution engine.
export async function isWorkflowModuleEnabled(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<boolean> {
  // 1. Check if the subscription plan includes the automation_workflows entitlement
  const entitlements = await getTenantEntitlements(supabase, tenantId)
  if (entitlements['automation_workflows'] !== true) {
    return false
  }

  // 2. Check if the tenant has explicitly enabled the module
  const { data, error } = await supabase
    .from('tenant_modules')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_key', 'automation_workflows')
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return data.enabled
}
