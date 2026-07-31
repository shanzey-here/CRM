import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import {
  InsertContactInput,
  UpdateContactInput,
  InsertAddressInput,
  UpdateAddressInput,
} from '../schemas'

// Define the precise database types for return values
export type Contact = Database['public']['Tables']['contacts']['Row']
export type Address = Database['public']['Tables']['addresses']['Row']
export type ContactAddress = Database['public']['Tables']['contact_addresses']['Row']

export interface PaginationOptions {
  limit?: number
  offset?: number
}

export interface ContactFilterOptions extends PaginationOptions {
  searchQuery?: string
  type?: 'residential' | 'commercial'
}

// ============================================================================
// CONTACTS REPOSITORY
// ============================================================================

export async function getContacts(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options?: ContactFilterOptions
): Promise<{ data: Contact[] | null; count: number | null; error: Error | null }> {
  let query = supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId) // Explicit tenant scoping
    .order('created_at', { ascending: false })

  if (options?.type) {
    query = query.eq('type', options.type)
  }

  if (options?.searchQuery) {
    // Basic ilike search across name and email
    query = query.or(`first_name.ilike.%${options.searchQuery}%,last_name.ilike.%${options.searchQuery}%,email.ilike.%${options.searchQuery}%`)
  }

  if (options?.limit !== undefined) {
    const offset = options.offset || 0
    query = query.range(offset, offset + options.limit - 1)
  }

  const { data, count, error } = await query
  return { data, count, error }
}

export async function getContactById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string
): Promise<{ data: Contact | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  return { data, error }
}

export async function getContactByUserId(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  userId: string
): Promise<{ data: Contact | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .single()

  return { data, error }
}

export async function createContact(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  payload: InsertContactInput
): Promise<{ data: Contact | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contacts')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  return { data, error }
}

export async function updateContact(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  payload: UpdateContactInput
): Promise<{ data: Contact | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contacts')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

export async function archiveContact(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('contacts')
    .update({ is_archived: true })
    .eq('tenant_id', tenantId)
    .eq('id', id)

  return { error }
}

// ============================================================================
// ADDRESSES REPOSITORY
// ============================================================================

export async function getAddresses(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options?: PaginationOptions
): Promise<{ data: Address[] | null; error: Error | null }> {
  let query = supabase
    .from('addresses')
    .select('*')
    .eq('tenant_id', tenantId) // Explicit tenant scoping
    .order('created_at', { ascending: false })

  if (options?.limit !== undefined) {
    const offset = options.offset || 0
    query = query.range(offset, offset + options.limit - 1)
  }

  const { data, error } = await query
  return { data, error }
}

export async function getAddressById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string
): Promise<{ data: Address | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .single()

  return { data, error }
}

export async function createAddress(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  payload: InsertAddressInput
): Promise<{ data: Address | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('addresses')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  return { data, error }
}

export async function updateAddress(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  payload: UpdateAddressInput
): Promise<{ data: Address | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('addresses')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

// ============================================================================
// CONTACT ADDRESSES REPOSITORY
// ============================================================================

export async function getContactAddresses(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string
): Promise<{ data: (ContactAddress & { addresses: Address | null })[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('contact_addresses')
    .select(`
      *,
      addresses (*)
    `)
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  // We explicitly cast the returned joined data
  return { 
    data: data as (ContactAddress & { addresses: Address | null })[] | null, 
    error 
  }
}

// ============================================================================
// RELOCATION HISTORY
// ============================================================================

export type RelocationHistoryJob = {
  id: string
  status: string
  move_date: string | null
  created_at: string
  origin_address: { city: string; postcode: string } | null
  destination_address: { city: string; postcode: string } | null
  quote: { id: string; total_price: number } | { id: string; total_price: number }[] | null
}

export type RelocationHistoryQuote = {
  id: string
  status: string
  total_price: number
  valid_until: string | null
  created_at: string
}

export async function getContactRelocationHistory(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string
): Promise<{
  jobs: RelocationHistoryJob[]
  nonAcceptedQuotes: RelocationHistoryQuote[]
  error: Error | null
}> {
  const [jobsResult, quotesResult] = await Promise.all([
    supabase
      .from('jobs')
      .select(`
        id, status, move_date, created_at,
        origin_address:addresses!jobs_origin_address_fk(city, postcode),
        destination_address:addresses!jobs_destination_address_fk(city, postcode),
        quote:quotes(id, total_price)
      `)
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId),
    supabase
      .from('quotes')
      .select('id, status, total_price, valid_until, created_at')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .in('status', ['declined', 'expired']),
  ])

  const error = jobsResult.error || quotesResult.error || null

  return {
    jobs: (jobsResult.data as any) || [],
    nonAcceptedQuotes: quotesResult.data || [],
    error,
  }
}

export async function linkContactAddress(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string,
  addressId: string,
  label?: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('contact_addresses')
    .insert([{ 
      tenant_id: tenantId, 
      contact_id: contactId, 
      address_id: addressId,
      label 
    }])

  return { error }
}
