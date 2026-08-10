import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { EmailLabelInput } from '../schemas'

type Client = SupabaseClient<Database>

export async function getLabels(supabase: Client, tenantId: string) {
  return await supabase
    .from('email_labels')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
}

export async function getDefaultLabels(supabase: Client, tenantId: string) {
  return await supabase
    .from('email_labels')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
}

// Looks up which label (if any) already owns a color for this tenant, so a
// create/edit form can surface "This color is already used by X" with the
// real name, not just a generic conflict message.
export async function findLabelByColor(supabase: Client, tenantId: string, colorHex: string) {
  return await supabase
    .from('email_labels')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .ilike('color_hex', colorHex)
    .maybeSingle()
}

export async function createLabel(supabase: Client, tenantId: string, input: EmailLabelInput) {
  return await supabase
    .from('email_labels')
    .insert({ tenant_id: tenantId, name: input.name, color_hex: input.color_hex, is_default: false })
    .select()
    .single()
}

export async function updateLabel(supabase: Client, tenantId: string, labelId: string, input: EmailLabelInput) {
  return await supabase
    .from('email_labels')
    .update({ name: input.name, color_hex: input.color_hex, updated_at: new Date().toISOString() })
    .eq('id', labelId)
    .eq('tenant_id', tenantId) // strict boundary
    .select()
    .single()
}

// How many threads currently carry this label — shown in the delete
// confirmation before removal, since ON DELETE CASCADE means the delete
// itself won't fail, but a silent mass-removal deserves a real warning.
export async function getLabelUsageCount(supabase: Client, tenantId: string, labelId: string) {
  const { count, error } = await supabase
    .from('email_label_assignments')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('label_id', labelId)
  return { count: count ?? 0, error }
}

export async function deleteLabel(supabase: Client, tenantId: string, labelId: string) {
  return await supabase
    .from('email_labels')
    .delete()
    .eq('id', labelId)
    .eq('tenant_id', tenantId) // strict boundary
}

// Single batched query for every thread on the current inbox page — not
// per-row — joined to the label row for name/color.
export async function getLabelAssignmentsForThreads(supabase: Client, tenantId: string, threadIds: string[]) {
  if (threadIds.length === 0) return { data: [], error: null }
  return await supabase
    .from('email_label_assignments')
    .select('id, thread_id, label_id, email_labels ( id, name, color_hex )')
    .eq('tenant_id', tenantId)
    .in('thread_id', threadIds)
}

export async function getLabelAssignmentsForThread(supabase: Client, tenantId: string, threadId: string) {
  return await supabase
    .from('email_label_assignments')
    .select('id, label_id, email_labels ( id, name, color_hex )')
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
}

export async function assignLabel(
  supabase: Client,
  tenantId: string,
  threadId: string,
  labelId: string,
  appliedBy: string | null
) {
  return await supabase
    .from('email_label_assignments')
    .insert({ tenant_id: tenantId, thread_id: threadId, label_id: labelId, applied_by: appliedBy })
    .select()
    .single()
}

export async function removeLabelAssignment(supabase: Client, tenantId: string, assignmentId: string) {
  return await supabase
    .from('email_label_assignments')
    .delete()
    .eq('id', assignmentId)
    .eq('tenant_id', tenantId) // strict boundary
}

// ── Suggestions (assist/quote_review trust — pending review) ──────────────

export async function createLabelSuggestion(
  supabase: Client,
  tenantId: string,
  threadId: string,
  labelId: string,
  model: string
) {
  return await supabase
    .from('email_label_suggestions')
    .insert({ tenant_id: tenantId, thread_id: threadId, label_id: labelId, model })
    .select()
}

export async function deleteLabelSuggestion(supabase: Client, tenantId: string, threadId: string, labelId: string) {
  return await supabase
    .from('email_label_suggestions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('thread_id', threadId)
    .eq('label_id', labelId)
}

export async function getPendingLabelSuggestions(supabase: Client, tenantId: string) {
  return await supabase
    .from('email_label_suggestions')
    .select(
      `id, thread_id, label_id, suggested_at,
       email_labels ( name, color_hex ),
       email_threads ( subject, mailbox_id, contact_id,
         contacts ( first_name, last_name ),
         mailboxes ( mailbox_address ) )`
    )
    .eq('tenant_id', tenantId)
    .order('suggested_at', { ascending: true })
}
