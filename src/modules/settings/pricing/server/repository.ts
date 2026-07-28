import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { PricingSettingsInput } from '../schemas'

export async function getPricingSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('pricing_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  return { data, error }
}

export async function updatePricingSettings(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  updates: Partial<PricingSettingsInput>
) {
  const { data, error } = await supabase
    .from('pricing_settings')
    .update(updates)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  return { data, error }
}
