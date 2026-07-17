import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InsertTaskInput, UpdateTaskInput } from '../schemas'

export type Task = Database['public']['Tables']['tasks']['Row']

export async function getTasks(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId?: string,
  leadId?: string,
  assignedTo?: string
): Promise<{ data: Task[] | null; error: Error | null }> {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (contactId) {
    query = query.eq('contact_id', contactId)
  }
  if (leadId) {
    query = query.eq('lead_id', leadId)
  }
  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }

  const { data, error } = await query
  return { data, error }
}

export async function createTask(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  payload: InsertTaskInput & { created_by?: string }
): Promise<{ data: Task | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('tasks')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  return { data, error }
}

export async function updateTask(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  payload: UpdateTaskInput
): Promise<{ data: Task | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('tasks')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}
