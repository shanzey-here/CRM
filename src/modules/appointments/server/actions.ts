'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertAppointmentSchema, updateAppointmentSchema } from '../schemas'
import { createAppointment, updateAppointment } from './repository'

export async function createAppointmentAction(payload: any) {
  try {
    // CRITICAL: Must await createClient()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const tenantId = user.app_metadata?.tenant_id as string | undefined
    if (!tenantId) return { success: false, error: 'No tenant context' }

    const parseResult = insertAppointmentSchema.safeParse(payload)
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues.map((i) => i.message).join(', '),
      }
    }
    const parsed = parseResult.data

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
    console.log('createAppointment result:', { data, error, tenantId })
    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (err: any) {
    console.error('createAppointmentAction error:', err)
    return { success: false, error: err.message || 'Internal server error' }
  }
}

export async function updateAppointmentAction(id: string, payload: any) {
  try {
    // CRITICAL: Must await createClient()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const tenantId = user.app_metadata?.tenant_id as string | undefined
    if (!tenantId) return { success: false, error: 'No tenant context' }

    const parseResult = updateAppointmentSchema.safeParse(payload)
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues.map((i) => i.message).join(', '),
      }
    }
    const parsed = parseResult.data
    const { data, error } = await updateAppointment(supabase, tenantId, id, parsed)
    
    if (error) return { success: false, error: error.message }
    revalidatePath('/office/scheduling')
    return { success: true, data }
  } catch (err: any) {
    console.error('updateAppointmentAction error:', err)
    return { success: false, error: err.message || 'Internal server error' }
  }
}

export async function scheduleSurveyAction(input: {
  leadId: string
  payload: any
  ignoreConflict?: boolean
}): Promise<{
  success: boolean
  error?: string
  conflict?: boolean
  appointment?: any
}> {
  try {
    // 1. Create the appointment via existing appointments creation path (reuses createAppointmentAction)
    const appointmentResult = await createAppointmentAction({
      ...input.payload,
      ignore_conflict: input.ignoreConflict,
    })

    console.log('scheduleSurveyAction appointmentResult:', appointmentResult)

    if (!appointmentResult.success) {
      if (appointmentResult.error === 'DOUBLE_BOOKING_CONFLICT') {
        return { success: false, conflict: true, error: 'DOUBLE_BOOKING_CONFLICT' }
      }
      return { success: false, error: appointmentResult.error || 'Failed to schedule survey' }
    }

    // 2. Advance the lead stage to 'survey_scheduled' via existing shared transition function
    const { updateLeadStage } = await import('@/app/office/leads/actions')
    const stageResult = await updateLeadStage(input.leadId, 'survey_scheduled')
    
    revalidatePath('/office/scheduling')

    if (!stageResult.success) {
      return {
        success: true,
        appointment: appointmentResult.data,
        error: `Appointment scheduled, but stage transition failed: ${stageResult.error}`,
      }
    }

    return {
      success: true,
      appointment: appointmentResult.data,
    }
  } catch (err: any) {
    console.error('scheduleSurveyAction error:', err)
    return { success: false, error: err.message || 'Failed to schedule survey' }
  }
}
