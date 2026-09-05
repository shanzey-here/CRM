import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InsertLeadInput, UpdateLeadInput } from '../schemas'

// Define the precise database types for return values
export type Lead = Database['public']['Tables']['leads']['Row']

export type LeadContact = {
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  company_name?: string | null
}

export type LeadAddressPreview = {
  city: string
  postcode: string
} | null

export type LeadWithContact = Lead & {
  contact?: LeadContact | LeadContact[] | null
  // Only present when the caller's query explicitly joins these (the Kanban
  // board query does; getLeadById does not, since the lead detail page
  // already fetches the full address separately).
  origin_address?: LeadAddressPreview | LeadAddressPreview[]
  destination_address?: LeadAddressPreview | LeadAddressPreview[]
}

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

// DELIBERATE DECISION — this function is LEFT AS-IS by Epic F (audited under
// feature/phase4-follow-up-definition; full record in PHASE4_FOLLOW_UP_DECISION.md).
//
// Despite the name, this has NO staleness/time threshold — it returns the most
// recently-updated non-archived leads in `inquiry`/`quote_sent` (never the
// `follow_up` stage itself), and its ONLY caller is the Dashboard
// LeadsFollowUpWidget (src/app/office/page.tsx). It is purely informational.
//
// "Follow Up" as a Kanban concept was decided to be MANUAL and action-based:
// a staff member logs a real follow-up (note + contact method + optional
// reminder date) via the quick action, and that logged action moves the lead
// to `follow_up` through the canonical updateLeadStage(). There is no
// automatic, staleness-driven transition. This function is NOT reused or
// extended by that action — do not add a time threshold here, do not call it
// from the Follow Up action, and renaming it is out of scope for Epic F.
export async function getLeadsNeedingFollowUp(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  limit: number = 5
) {
  const { data, error } = await supabase
    .from('leads')
    .select(`
      id,
      stage,
      source,
      updated_at,
      contact:contacts(first_name, last_name)
    `)
    .eq('tenant_id', tenantId)
    .in('stage', ['inquiry', 'quote_sent'])
    .eq('is_archived', false)
    .order('updated_at', { ascending: false, nullsFirst: false }) // Newest first, ignore nulls
    .limit(limit)

  return { success: !error, leads: data || [], error: error?.message }
}

