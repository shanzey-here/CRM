import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InsertInventoryInput, UpdateInventoryInput } from '../schemas'

export async function getInventoryItems(supabase: SupabaseClient<Database>, tenantId: string) {
  return await supabase
    .from('inventory_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })
}

export async function getActiveInventoryItems(supabase: SupabaseClient<Database>, tenantId: string) {
  return await supabase
    .from('inventory_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })
}

export async function createInventoryItem(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: InsertInventoryInput
) {
  return await supabase
    .from('inventory_items')
    .insert({
      ...input,
      tenant_id: tenantId
    })
    .select()
    .single()
}

export async function updateInventoryItem(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  itemId: string,
  input: UpdateInventoryInput
) {
  return await supabase
    .from('inventory_items')
    .update(input)
    .eq('id', itemId)
    .eq('tenant_id', tenantId) // strict boundary
    .select()
    .single()
}

export async function deleteInventoryItem(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  itemId: string
) {
  // CRITICAL: Soft-delete only, to prevent historical quoting engine corruption
  return await supabase
    .from('inventory_items')
    .update({ is_active: false })
    .eq('id', itemId)
    .eq('tenant_id', tenantId) // strict boundary
    .select()
    .single()
}
