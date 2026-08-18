'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Database } from '@/types/database.types'
import { 
  createVehicle as createVehicleRepo,
  updateVehicle as updateVehicleRepo,
  addVehicleDocument,
  addVehicleMaintenance
} from '@/modules/fleet/server/repository'

async function requireAdminOrDispatcher() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) throw new Error('Unauthorized')
  
  const tenantId = user.app_metadata.tenant_id
  const tenantRole = user.app_metadata.tenant_role
  
  if (!tenantId) throw new Error('No tenant context')
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden: Only admins and dispatchers can perform this action')
  }
  
  return { supabase, session: { user }, tenantId, tenantRole }
}

export async function createVehicleAction(formData: FormData) {
  try {
    const { supabase, tenantId } = await requireAdminOrDispatcher()
    
    const name = formData.get('name') as string
    const registration = formData.get('registration') as string
    const type = formData.get('type') as string
    const capacityCubicStr = formData.get('capacityCubic') as string
    
    if (!name) throw new Error('Vehicle name is required')

    await createVehicleRepo(supabase, tenantId, {
      name,
      registration: registration || undefined,
      type: type || undefined,
      capacityCubic: capacityCubicStr ? parseInt(capacityCubicStr, 10) : undefined
    })

    revalidatePath('/office/fleet')
    return { success: true }
  } catch (err: any) {
    console.error('createVehicleAction error:', err)
    return { success: false, error: err.message }
  }
}

export async function updateVehicleAction(vehicleId: string, formData: FormData) {
  try {
    const { supabase, tenantId } = await requireAdminOrDispatcher()
    
    const name = formData.get('name') as string
    const registration = formData.get('registration') as string
    const type = formData.get('type') as string
    const capacityCubicStr = formData.get('capacityCubic') as string
    const isActiveStr = formData.get('isActive') as string

    if (!name) throw new Error('Vehicle name is required')

    await updateVehicleRepo(supabase, tenantId, vehicleId, {
      name,
      registration: registration || undefined,
      type: type || undefined,
      capacityCubic: capacityCubicStr ? parseInt(capacityCubicStr, 10) : undefined,
      isActive: isActiveStr === 'true'
    })

    revalidatePath(`/office/fleet/${vehicleId}`)
    revalidatePath('/office/fleet')
    return { success: true }
  } catch (err: any) {
    console.error('updateVehicleAction error:', err)
    return { success: false, error: err.message }
  }
}

export async function addVehicleDocumentAction(formData: FormData) {
  try {
    const { supabase, session, tenantId } = await requireAdminOrDispatcher()
    
    const vehicleId = formData.get('vehicleId') as string
    const documentType = formData.get('documentType') as any
    const filePath = formData.get('filePath') as string
    const expiryDate = formData.get('expiryDate') as string
    
    if (!vehicleId || !documentType || !filePath) {
      throw new Error('Missing required document metadata fields')
    }

    await addVehicleDocument(supabase, tenantId, {
      vehicleId,
      documentType,
      filePath,
      expiryDate: expiryDate || undefined,
      uploadedBy: session.user.id
    })

    revalidatePath(`/office/fleet/${vehicleId}`)
    return { success: true }
  } catch (err: any) {
    console.error('addVehicleDocumentAction error:', err)
    return { success: false, error: err.message }
  }
}

export async function addVehicleMaintenanceAction(formData: FormData) {
  try {
    const { supabase, session, tenantId } = await requireAdminOrDispatcher()
    
    const vehicleId = formData.get('vehicleId') as string
    const maintenanceType = formData.get('maintenanceType') as any
    const performedAt = formData.get('performedAt') as string
    const costStr = formData.get('cost') as string
    const nextDueDate = formData.get('nextDueDate') as string
    const notes = formData.get('notes') as string
    
    if (!vehicleId || !maintenanceType || !performedAt) {
      throw new Error('Missing required maintenance fields')
    }

    await addVehicleMaintenance(supabase, tenantId, {
      vehicleId,
      maintenanceType,
      performedAt,
      cost: costStr ? parseFloat(costStr) : undefined,
      nextDueDate: nextDueDate || undefined,
      notes: notes || undefined,
      loggedBy: session.user.id
    })

    revalidatePath(`/office/fleet/${vehicleId}`)
    return { success: true }
  } catch (err: any) {
    console.error('addVehicleMaintenanceAction error:', err)
    return { success: false, error: err.message }
  }
}
