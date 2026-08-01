'use server'

import { createClient } from '@/lib/supabase/server'
import { getJobDetails } from '@/modules/jobs/server/repository'
import { addDays, format } from 'date-fns'

/**
 * Fetches the next 7 days of jobs assigned to the current crew member,
 * along with the full job sheet details for each, designed for offline caching.
 */
export async function syncCrewJobs() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id
  const userId = user.id

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  // Fetch assignments strictly scoped to this user
  const { data: assignments, error: assignmentsError } = await supabase
    .from('job_crew_assignments')
    .select(`
      job_id,
      jobs!inner(
        id, status, move_date,
        contact:contacts(first_name, last_name)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .gte('jobs.move_date', todayStr)
    .lte('jobs.move_date', nextWeekStr)
    .not('jobs.status', 'eq', 'cancelled')

  if (assignmentsError) {
    return { success: false, error: assignmentsError.message }
  }

  // Flatten the result to just an array of jobs and sort by date
  const jobsList = assignments
    .map(a => a.jobs)
    // Supabase returns inner joined objects, but TypeScript might see them as arrays if it thinks it's a 1-to-many.
    // In this case jobs is a 1-to-1 from the assignment's perspective, so we cast it safely.
    .map(j => (Array.isArray(j) ? j[0] : j) as any)
    .sort((a, b) => new Date(a.move_date).getTime() - new Date(b.move_date).getTime())

  // Fetch full job details for each job for offline caching
  const detailedJobs: Record<string, any> = {}
  
  for (const job of jobsList) {
    const { success, jobDetails } = await getJobDetails(supabase, tenantId, job.id)
    if (success && jobDetails) {
      detailedJobs[job.id] = jobDetails
    }
  }

  return { 
    success: true, 
    jobsList, 
    detailedJobs,
    syncedAt: new Date().toISOString()
  }
}

/**
 * Fetches the live job details for a specific job, strictly ensuring the current
 * crew member is assigned to it before returning data.
 */
export async function getCrewJobDetails(jobId: string) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id
  const userId = user.id

  // Explicit access check: Does this crew member have an assignment for this job?
  const { data: assignment, error: assignmentError } = await supabase
    .from('job_crew_assignments')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('job_id', jobId)
    .single()

  if (assignmentError || !assignment) {
    return { success: false, error: 'Unauthorized or not assigned to this job' }
  }

  // Fetch the full job details
  const result = await getJobDetails(supabase, tenantId, jobId)
  
  return {
    ...result,
    syncedAt: new Date().toISOString()
  }
}
