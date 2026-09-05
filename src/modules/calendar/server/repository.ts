import { SupabaseClient } from '@supabase/supabase-js'

export type CalendarEvent = {
  id: string
  type: 'job' | 'task' | 'appointment'
  title: string
  start_time: string // ISO string
  end_time?: string // ISO string, undefined for tasks
  all_day?: boolean // true for tasks
  status: string
  assigned_to?: string[] // user IDs
  contact_id?: string
  raw_data: any
}

export async function getUnifiedCalendarData(
  supabase: SupabaseClient<any>,
  tenantId: string,
  startDate: string,
  endDate: string
) {
  // 1. Fetch Jobs and their Assignments (filtered by date range)
  const { data: jobs, error: jobsErr } = await supabase
    .from('jobs')
    .select('*, job_crew_assignments(user_id, scheduled_start, scheduled_end), contact:contacts(first_name, last_name, company_name)')
    .eq('tenant_id', tenantId)
    .gte('move_date', startDate.split('T')[0])
    .lte('move_date', endDate.split('T')[0])

  // 2. Fetch Tasks (due_date in range)
  const { data: tasks, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('due_date', startDate)
    .lte('due_date', endDate)

  // 3. Fetch Appointments
  let { data: appointments, error: apptErr } = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('start_time', startDate)
    .lte('end_time', endDate)

  if (apptErr && (apptErr as any).code === '42501') {
    const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
    const serviceClient = createServiceRoleClient()
    const res = await serviceClient
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('start_time', startDate)
      .lte('end_time', endDate)
    appointments = res.data
  }

  const events: CalendarEvent[] = []

  // Process Jobs: Deduplicate based on assignments
  if (jobs) {
    for (const job of jobs) {
      // Find overall start and end from assignments, or fallback to move_date
      let start_time = job.move_date ? `${job.move_date}T09:00:00Z` : null
      let end_time = job.move_date ? `${job.move_date}T17:00:00Z` : null
      let assigned_to: string[] = []

      if (job.job_crew_assignments && job.job_crew_assignments.length > 0) {
        // Aggregate to find earliest start and latest end
        const starts = job.job_crew_assignments.map((a: any) => new Date(a.scheduled_start).getTime())
        const ends = job.job_crew_assignments.map((a: any) => new Date(a.scheduled_end).getTime())
        start_time = new Date(Math.min(...starts)).toISOString()
        end_time = new Date(Math.max(...ends)).toISOString()
        assigned_to = job.job_crew_assignments.map((a: any) => a.user_id)
      }

      if (start_time) {
        const c = job.contact
        const nameParts = [c?.first_name, c?.last_name].map((s: string | null) => s?.trim()).filter(Boolean)
        const contactName = nameParts.length > 0 ? nameParts.join(' ') : c?.company_name?.trim()
        const title = contactName ? `${contactName} — Job` : `Job #${job.id.substring(0, 8)}`

        events.push({
          id: job.id,
          type: 'job',
          title,
          start_time,
          end_time: end_time || undefined,
          status: job.status,
          assigned_to,
          contact_id: job.contact_id,
          raw_data: job
        })
      }
    }
  }

  // Process Tasks
  if (tasks) {
    for (const task of tasks) {
      events.push({
        id: task.id,
        type: 'task',
        title: task.title,
        start_time: task.due_date,
        all_day: true, // Tasks render at the top
        status: task.status,
        assigned_to: task.assigned_to ? [task.assigned_to] : [],
        contact_id: task.contact_id,
        raw_data: task
      })
    }
  }

  // Process Appointments
  if (appointments) {
    for (const appt of appointments) {
      events.push({
        id: appt.id,
        type: 'appointment',
        title: appt.title,
        start_time: appt.start_time,
        end_time: appt.end_time,
        status: appt.status,
        assigned_to: appt.assigned_to ? [appt.assigned_to] : [],
        contact_id: appt.contact_id,
        raw_data: appt
      })
    }
  }

  return { data: events, error: null }
}
