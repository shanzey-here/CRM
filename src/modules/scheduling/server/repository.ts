import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { CreateJobCrewAssignmentData, CreateJobVehicleAssignmentData } from '../schema'

function parsePostgresError(error: any): string {
  // Catch Postgres Exclusion Constraint violation
  if (error.code === '23P01') {
    const errorString = (error.message || '') + ' ' + (error.details || '')
    if (errorString.includes('no_crew_double_booking')) {
      return 'This crew member is already assigned to an overlapping job.'
    }
    if (errorString.includes('no_vehicle_double_booking')) {
      return 'This vehicle is already booked for an overlapping time.'
    }
    return 'This assignment conflicts with an existing booking.'
  }
  
  // Catch Check Constraint violation
  if (error.code === '23514') {
    const errorString = (error.message || '') + ' ' + (error.details || '')
    if (errorString.includes('job_crew_time_valid') || errorString.includes('job_vehicle_time_valid')) {
      return 'Scheduled end time must be after the scheduled start time.'
    }
  }

  return error.message || 'An unknown database error occurred.'
}

export async function assignCrewToJob(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  assignmentData: CreateJobCrewAssignmentData
) {
  const { data, error } = await supabase
    .from('job_crew_assignments')
    .insert({
      tenant_id: tenantId,
      job_id: assignmentData.job_id,
      user_id: assignmentData.user_id,
      scheduled_start: assignmentData.scheduled_start,
      scheduled_end: assignmentData.scheduled_end,
      notes: assignmentData.notes || null
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: parsePostgresError(error) }
  }

  return { success: true, assignment: data }
}

export async function assignVehicleToJob(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  assignmentData: CreateJobVehicleAssignmentData
) {
  const { data, error } = await supabase
    .from('job_vehicle_assignments')
    .insert({
      tenant_id: tenantId,
      job_id: assignmentData.job_id,
      vehicle_id: assignmentData.vehicle_id,
      scheduled_start: assignmentData.scheduled_start,
      scheduled_end: assignmentData.scheduled_end,
      notes: assignmentData.notes || null
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: parsePostgresError(error) }
  }

  return { success: true, assignment: data }
}

export async function getJobAssignments(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string
) {
  const [crewRes, vehicleRes] = await Promise.all([
    supabase
      .from('job_crew_assignments')
      .select('*, user:users(id, full_name)')
      .eq('tenant_id', tenantId)
      .eq('job_id', jobId)
      .order('scheduled_start', { ascending: true }),
    supabase
      .from('job_vehicle_assignments')
      .select('*, vehicle:vehicles(id, name, type)')
      .eq('tenant_id', tenantId)
      .eq('job_id', jobId)
      .order('scheduled_start', { ascending: true })
  ])

  if (crewRes.error) return { success: false, error: crewRes.error.message }
  if (vehicleRes.error) return { success: false, error: vehicleRes.error.message }

  return { 
    success: true, 
    crewAssignments: crewRes.data,
    vehicleAssignments: vehicleRes.data
  }
}

export async function getSchedulingBoardData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  dateStr: string // YYYY-MM-DD
) {
  const [vehiclesRes, crewRes, jobsRes] = await Promise.all([
    supabase.from('vehicles')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name'),
    supabase.from('users')
      .select('id, full_name, role')
      .eq('tenant_id', tenantId)
      .eq('role', 'crew')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('jobs')
      .select(`
        id, move_date, status, contact_id, quote_id,
        contact:contacts(first_name, last_name, company_name),
        quote:quotes(total_volume),
        job_crew_assignments(*),
        job_vehicle_assignments(*)
      `)
      .eq('tenant_id', tenantId)
      .eq('move_date', dateStr)
      .neq('status', 'cancelled')
  ])

  if (vehiclesRes.error) return { success: false, error: vehiclesRes.error.message }
  if (crewRes.error) return { success: false, error: crewRes.error.message }
  if (jobsRes.error) return { success: false, error: jobsRes.error.message }

  return {
    success: true,
    data: {
      vehicles: vehiclesRes.data,
      crew: crewRes.data,
      jobs: jobsRes.data
    }
  }
}

