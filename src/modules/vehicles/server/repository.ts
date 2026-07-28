import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { VehicleSchema, CreateVehicleData, UpdateVehicleData } from '../schema'

export async function getVehiclesByTenant(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  includeArchived = false
) {
  let query = supabase
    .from('vehicles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  if (!includeArchived) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, vehicles: data }
}

export async function createVehicle(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  vehicleData: CreateVehicleData
) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      tenant_id: tenantId,
      name: vehicleData.name,
      type: vehicleData.type,
      capacity_cubic: vehicleData.capacity_cubic,
      is_active: vehicleData.is_active ?? true
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, vehicle: data }
}

export async function updateVehicle(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  vehicleId: string,
  updates: UpdateVehicleData
) {
  const { data, error } = await supabase
    .from('vehicles')
    .update(updates)
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, vehicle: data }
}

export async function archiveVehicle(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  vehicleId: string
) {
  // Soft delete approach matching the inventory items
  const { error } = await supabase
    .from('vehicles')
    .update({ is_active: false })
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
