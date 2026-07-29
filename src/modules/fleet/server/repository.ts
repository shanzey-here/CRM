import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type VehicleDocumentType = Database['public']['Enums']['vehicle_document_type']
type VehicleMaintenanceType = Database['public']['Enums']['vehicle_maintenance_type']

// Emit a standard domain event for fleet actions
async function emitFleetEvent(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const { error } = await supabase.from('domain_events').insert({
    tenant_id: tenantId,
    event_type: eventType,
    source_module: 'fleet',
    payload: payload as any
  })

  if (error) {
    console.error(`Failed to emit ${eventType}:`, error)
    throw error
  }
}

export async function addVehicleDocument(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  params: {
    vehicleId: string
    documentType: VehicleDocumentType
    filePath: string
    expiryDate?: string
    uploadedBy: string
  }
) {
  const { data, error } = await supabase
    .from('vehicle_documents')
    .insert({
      tenant_id: tenantId,
      vehicle_id: params.vehicleId,
      document_type: params.documentType,
      file_path: params.filePath,
      expiry_date: params.expiryDate ?? null,
      uploaded_by: params.uploadedBy
    })
    .select()
    .single()

  if (error) throw error

  await emitFleetEvent(supabase, tenantId, 'vehicle.document_uploaded', {
    documentId: data.id,
    vehicleId: data.vehicle_id,
    documentType: data.document_type
  })

  return data
}

export async function addVehicleMaintenance(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  params: {
    vehicleId: string
    maintenanceType: VehicleMaintenanceType
    performedAt: string
    cost?: number
    nextDueDate?: string
    notes?: string
    loggedBy: string
  }
) {
  const { data, error } = await supabase
    .from('vehicle_maintenance_records')
    .insert({
      tenant_id: tenantId,
      vehicle_id: params.vehicleId,
      maintenance_type: params.maintenanceType,
      performed_at: params.performedAt,
      cost: params.cost ?? null,
      next_due_date: params.nextDueDate ?? null,
      notes: params.notes ?? null,
      logged_by: params.loggedBy
    })
    .select()
    .single()

  if (error) throw error

  await emitFleetEvent(supabase, tenantId, 'vehicle.maintenance_logged', {
    maintenanceId: data.id,
    vehicleId: data.vehicle_id,
    maintenanceType: data.maintenance_type
  })

  return data
}
