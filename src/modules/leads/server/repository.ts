import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InsertLeadInput, UpdateLeadInput } from '../schemas'

// Define the precise database types for return values
export type Lead = Database['public']['Tables']['leads']['Row']

export interface PaginationOptions {
  limit?: number
  offset?: number
}

export interface LeadFilterOptions extends PaginationOptions {
  stage?: Lead['stage']
}

// ============================================================================
// LEADS REPOSITORY
// ============================================================================

export async function getLeads(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options?: LeadFilterOptions
): Promise<{ data: Lead[] | null; count: number | null; error: Error | null }> {
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId) // Explicit tenant scoping
    .order('created_at', { ascending: false })

  if (options?.stage) {
    query = query.eq('stage', options.stage)
  }

  if (options?.limit !== undefined) {
    const offset = options.offset || 0
    query = query.range(offset, offset + options.limit - 1)
  }

  const { data, count, error } = await query
  return { data, count, error }
}

export async function getLeadById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string
): Promise<{ data: Lead | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  return { data, error }
}

export async function createLead(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  payload: InsertLeadInput
): Promise<{ data: Lead | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('leads')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  return { data, error }
}

export async function updateLead(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  payload: UpdateLeadInput
): Promise<{ data: Lead | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('leads')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

export async function archiveLead(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('leads')
    .update({ is_archived: true })
    .eq('tenant_id', tenantId)
    .eq('id', id)

  return { error }
}
