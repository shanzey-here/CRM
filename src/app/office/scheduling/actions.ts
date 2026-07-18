'use server'

import { createClient } from '@/lib/supabase/server'
import { assignCrewToJob, assignVehicleToJob } from '@/modules/scheduling/server/repository'
import { revalidatePath } from 'next/cache'

export async function assignCrewAction(
  jobId: string,
  userId: string,
  startTime: string,
  endTime: string
) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const tenantId = user.app_metadata.tenant_id
  if (!tenantId) return { success: false, error: 'No tenant context' }

  const result = await assignCrewToJob(supabase, tenantId, {
    job_id: jobId,
    user_id: userId,
    scheduled_start: startTime,
    scheduled_end: endTime
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/office/scheduling')
  return { success: true }
}

export async function assignVehicleAction(
  jobId: string,
  vehicleId: string,
  startTime: string,
  endTime: string
) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const tenantId = user.app_metadata.tenant_id
  if (!tenantId) return { success: false, error: 'No tenant context' }

  const result = await assignVehicleToJob(supabase, tenantId, {
    job_id: jobId,
    vehicle_id: vehicleId,
    scheduled_start: startTime,
    scheduled_end: endTime
  })

  if (!result.success) {
    return { success: false, error: result.error }
  }

  revalidatePath('/office/scheduling')
  return { success: true }
}

export async function removeCrewAssignmentAction(assignmentId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const tenantId = user.app_metadata.tenant_id
  
  const { error } = await supabase.from('job_crew_assignments').delete().eq('id', assignmentId).eq('tenant_id', tenantId)
  if (error) return { success: false, error: error.message }
  
  revalidatePath('/office/scheduling')
  return { success: true }
}

export async function removeVehicleAssignmentAction(assignmentId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }
  const tenantId = user.app_metadata.tenant_id
  
  const { error } = await supabase.from('job_vehicle_assignments').delete().eq('id', assignmentId).eq('tenant_id', tenantId)
  if (error) return { success: false, error: error.message }
  
  revalidatePath('/office/scheduling')
  return { success: true }
}
