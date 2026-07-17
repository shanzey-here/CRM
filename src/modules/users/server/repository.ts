import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export type TenantUser = {
  id: string
  full_name: string | null
  email: string
  role: string
}

export async function getTenantStaff(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ data: TenantUser[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role')
    .eq('tenant_id', tenantId)
    .in('role', ['tenant_admin', 'dispatcher', 'crew'])
    .order('full_name')

  return { data: data as TenantUser[] | null, error }
}
