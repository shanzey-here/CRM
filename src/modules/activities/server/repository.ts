import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InsertActivityInput, UpdateActivityInput } from '../schemas'

export type Activity = Database['public']['Tables']['activities']['Row']

export async function getActivities(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId?: string,
  leadId?: string
): Promise<{ data: Activity[] | null; error: Error | null }> {
  let query = supabase
    .from('activities')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (contactId) {
    query = query.eq('contact_id', contactId)
  }
  if (leadId) {
    query = query.eq('lead_id', leadId)
  }

  const { data, error } = await query
  return { data, error }
}

export async function createActivity(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  payload: InsertActivityInput
): Promise<{ data: Activity | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('activities')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  return { data, error }
}

export async function updateActivityNote(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  payload: UpdateActivityInput
): Promise<{ data: Activity | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('activities')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}
