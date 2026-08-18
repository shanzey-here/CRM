import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export async function getContactLtv(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string
): Promise<number> {
  const { data, error } = await supabase.rpc('get_contact_ltv', {
    p_tenant_id: tenantId,
    p_contact_id: contactId
  })

  if (error) throw error
  return typeof data === 'number' ? data : 0
}

export async function getRepeatCustomers(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ contact_id: string; completed_jobs_count: number }[]> {
  const { data, error } = await supabase.rpc('get_repeat_customers', {
    p_tenant_id: tenantId
  })

  if (error) throw error
  return data || []
}

export async function getConversionFunnel(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<{
  total_leads: number
  quoted_leads: number
  accepted_leads: number
  sources: Record<string, number>
}> {
  const { data, error } = await supabase.rpc('get_conversion_funnel', {
    p_tenant_id: tenantId,
    p_start_date: startDate,
    p_end_date: endDate
  })

  if (error) throw error
  return data as any
}
