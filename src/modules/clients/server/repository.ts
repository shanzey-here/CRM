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

export interface PaginationOptions {
  limit?: number
  offset?: number
}

// ============================================================================
// CONTACTS REPOSITORY
// ============================================================================

export async function getContacts(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options?: PaginationOptions
): Promise<{ data: Contact[] | null; error: Error | null }> {
  let query = supabase
    .from('contacts')
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
