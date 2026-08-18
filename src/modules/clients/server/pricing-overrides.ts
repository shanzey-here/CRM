import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { ContactPricingOverrideInput } from '../schemas'

export type ContactPricingOverride = Database['public']['Tables']['contact_pricing_overrides']['Row']

export async function getContactPricingOverride(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string
): Promise<{ data: ContactPricingOverride | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contact_pricing_overrides')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .maybeSingle()

  return { data, error }
}

// One row per (tenant_id, contact_id) — "set" or "edit" is always this
// same upsert, matching the migration's UNIQUE (tenant_id, contact_id).
export async function upsertContactPricingOverride(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string,
  payload: ContactPricingOverrideInput,
  createdBy: string
): Promise<{ data: ContactPricingOverride | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contact_pricing_overrides')
    .upsert(
      {
        tenant_id: tenantId,
        contact_id: contactId,
        discount_percent: payload.discount_percent,
        notes: payload.notes ?? null,
        is_active: true,
        created_by: createdBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,contact_id' }
    )
    .select()
    .single()

  return { data, error }
}

export async function setContactPricingOverrideActive(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string,
  isActive: boolean
): Promise<{ data: ContactPricingOverride | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contact_pricing_overrides')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .select()
    .single()

  return { data, error }
}
