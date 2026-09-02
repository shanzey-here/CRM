import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { BrandFormInput } from '../schemas'

export type Brand = Database['public']['Tables']['brands']['Row']

export async function getBrands(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ data: Brand[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  return { data, error }
}

export async function getBrandById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string
): Promise<{ data: Brand | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  return { data, error }
}

// The single fallback used everywhere a brand_id is optional at the call
// site (manual lead/quote/job creation with no selector shown, AI-drafted
// leads from a mailbox that predates brand assignment, etc.) — every one of
// those call sites resolves through this function rather than each
// re-implementing its own "find the default brand" query.
export async function getDefaultBrandId(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('brands')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_default', true)
    .single()

  return data?.id ?? null
}

export async function createBrand(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: BrandFormInput
): Promise<{ data: Brand | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('brands')
    .insert({
      tenant_id: tenantId,
      name: input.name,
      logo_url: input.logo_url || null,
      color: input.color || null,
      email: input.email || null,
      phone: input.phone || null,
      address_line_1: input.address_line_1 || null,
      address_line_2: input.address_line_2 || null,
      address_city: input.address_city || null,
      address_county: input.address_county || null,
      address_postcode: input.address_postcode || null,
      address_country: input.address_country || null,
      vat_number: input.vat_number || null,
      bank_details: input.bank_details || null,
      terms_text: input.terms_text || null,
      is_default: false,
    })
    .select()
    .single()

  return { data, error }
}

export async function updateBrand(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  input: BrandFormInput
): Promise<{ data: Brand | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('brands')
    .update({
      name: input.name,
      logo_url: input.logo_url || null,
      color: input.color || null,
      email: input.email || null,
      phone: input.phone || null,
      address_line_1: input.address_line_1 || null,
      address_line_2: input.address_line_2 || null,
      address_city: input.address_city || null,
      address_county: input.address_county || null,
      address_postcode: input.address_postcode || null,
      address_country: input.address_country || null,
      vat_number: input.vat_number || null,
      bank_details: input.bank_details || null,
      terms_text: input.terms_text || null,
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}
