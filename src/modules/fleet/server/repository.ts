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

export async function createVehicle(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  params: {
    name: string
    registration?: string
    type?: string
    capacityCubic?: number
  }
) {
  const { data, error } = await supabase
    .from('vehicles')
    .insert({
      tenant_id: tenantId,
      name: params.name,
      registration: params.registration ?? null,
      type: params.type ?? null,
      capacity_cubic: params.capacityCubic ?? null
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateVehicle(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  vehicleId: string,
  params: {
    name?: string
    registration?: string
    type?: string
    capacityCubic?: number
    isActive?: boolean
  }
) {
  const { data, error } = await supabase
    .from('vehicles')
    .update({
      name: params.name,
      registration: params.registration,
      type: params.type,
      capacity_cubic: params.capacityCubic,
      is_active: params.isActive
    })
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getVehicles(supabase: SupabaseClient<Database>, tenantId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name')
  
  if (error) throw error
  return data
}

export async function getVehicleById(supabase: SupabaseClient<Database>, tenantId: string, vehicleId: string) {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .eq('tenant_id', tenantId)
    .single()
  
  if (error) throw error
  return data
}

export async function getVehicleDocuments(supabase: SupabaseClient<Database>, tenantId: string, vehicleId: string) {
  const { data, error } = await supabase
    .from('vehicle_documents')
    .select('*, users ( first_name, last_name )')
    .eq('vehicle_id', vehicleId)
    .eq('tenant_id', tenantId)
    .order('uploaded_at', { ascending: false })
  
  if (error) throw error
  return data
}

export async function getVehicleMaintenanceHistory(supabase: SupabaseClient<Database>, tenantId: string, vehicleId: string) {
  const { data, error } = await supabase
    .from('vehicle_maintenance_records')
    .select('*, users ( first_name, last_name )')
    .eq('vehicle_id', vehicleId)
    .eq('tenant_id', tenantId)
    .order('performed_at', { ascending: false })
  
  if (error) throw error
  return data
}

export async function getFleetAlerts(supabase: SupabaseClient<Database>, tenantId: string) {
  const now = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(now.getDate() + 30)

  // Format dates for Postgres
  const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0]
  const todayStr = now.toISOString().split('T')[0]

  const [docsResult, maintResult] = await Promise.all([
    supabase
      .from('vehicle_documents')
      .select('*, vehicles ( name, registration )')
      .eq('tenant_id', tenantId)
      .lte('expiry_date', thirtyDaysStr)
      .order('expiry_date', { ascending: true }),
    supabase
      .from('vehicle_maintenance_records')
      .select('*, vehicles ( name, registration )')
      .eq('tenant_id', tenantId)
      .lte('next_due_date', todayStr)
      .order('next_due_date', { ascending: true })
  ])

  if (docsResult.error) throw docsResult.error
  if (maintResult.error) throw maintResult.error

  return {
    expiringDocuments: docsResult.data,
    overdueMaintenance: maintResult.data
  }
}
