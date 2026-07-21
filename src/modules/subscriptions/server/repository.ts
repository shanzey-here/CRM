import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export async function getAvailablePlans(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from('saas_plans')
    .select(`
      *,
      saas_prices (*)
    `)
    .eq('is_active', true)
    // Assuming saas_prices also has is_active, but supabase filter syntax requires an inner join filter or post-processing
    // For now, we'll just fetch them all and filter active prices in code if needed
  
  if (error) {
    console.error('Error fetching available plans:', error)
    throw error
  }

  return data
}

export async function getTenantSubscription(supabase: SupabaseClient<Database>, tenantId: string) {
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select(`
      *,
      saas_prices (
        *,
        saas_plans (*)
      )
    `)
    .eq('tenant_id', tenantId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is 'no rows returned'
    console.error('Error fetching tenant subscription:', error)
    throw error
  }

  return data || null
}
