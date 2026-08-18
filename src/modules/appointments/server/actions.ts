'use server'

import { createClient } from '@/lib/supabase/server'
import { insertAppointmentSchema, updateAppointmentSchema } from '../schemas'
import { createAppointment, updateAppointment } from './repository'

export async function createAppointmentAction(payload: any) {
  // CRITICAL: Must await createClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata.tenant_id
  if (!tenantId) throw new Error('No tenant ID')

  const parsed = insertAppointmentSchema.parse(payload)

  // Conflict check logic (soft booking warning for Jobs vs Appointments)
  if (parsed.assigned_to) {
    const { data: conflicts, error: conflictErr } = await supabase
      .from('job_crew_assignments')
      .select('id, scheduled_start, scheduled_end')
      .eq('tenant_id', tenantId)
      .eq('user_id', parsed.assigned_to)
      .lt('scheduled_start', parsed.end_time)
      .gt('scheduled_end', parsed.start_time)

    if (!conflictErr && conflicts && conflicts.length > 0) {
      if (!payload.ignore_conflict) {
        return { success: false, error: 'DOUBLE_BOOKING_CONFLICT' }
      }
    }
  }

  const { data, error } = await createAppointment(supabase, tenantId, parsed)
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function updateAppointmentAction(id: string, payload: any) {
  // CRITICAL: Must await createClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata.tenant_id
  if (!tenantId) throw new Error('No tenant ID')

  const parsed = updateAppointmentSchema.parse(payload)
  const { data, error } = await updateAppointment(supabase, tenantId, id, parsed)
  
  if (error) return { success: false, error: error.message }
  return { success: true, data }
}
