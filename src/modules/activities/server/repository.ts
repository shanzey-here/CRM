import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InsertActivityInput, UpdateActivityInput } from '../schemas'

export type Activity = Database['public']['Tables']['activities']['Row']

export async function getActivities(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId?: string,
  leadId?: string
): Promise<{ data: Activity[] | null; error: Error | null }> {
  let query = supabase
    .from('activities')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (contactId) {
    query = query.eq('contact_id', contactId)
  }
  if (leadId) {
    query = query.eq('lead_id', leadId)
  }

  const { data, error } = await query
  return { data, error }
}

export async function createActivity(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  payload: InsertActivityInput
): Promise<{ data: Activity | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('activities')
    .insert([{ ...payload, tenant_id: tenantId } as any])
    .select()
    .single()

  return { data, error }
}

export async function updateActivityNote(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  payload: UpdateActivityInput
): Promise<{ data: Activity | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('activities')
    .update(payload as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .select()
    .single()

  return { data, error }
}

export type TimelineItem = {
  id: string
  type: 'activity' | 'task'
  subType: string // e.g. 'note', 'stage_change', 'call' for activities, 'task' for tasks
  content: string // activity content or task title
  status?: string // task status
  createdAt: string
  createdBy: string | null
  assignedTo?: string | null
  completedAt?: string | null
}

export async function getTimeline(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filters: { contactId?: string; leadId?: string }
): Promise<{ data: TimelineItem[] | null; error: Error | null }> {
  // Fetch activities
  let actQuery = supabase
    .from('activities')
    .select('*, users(full_name)')
    .eq('tenant_id', tenantId)
  
  if (filters.contactId) actQuery = actQuery.eq('contact_id', filters.contactId)
  if (filters.leadId) actQuery = actQuery.eq('lead_id', filters.leadId)

  // Fetch tasks
  let taskQuery = supabase
    .from('tasks')
    .select('*, assignee:users!tasks_assigned_to_fkey(full_name), creator:users!tasks_created_by_fkey(full_name)')
    .eq('tenant_id', tenantId)

  if (filters.contactId) taskQuery = taskQuery.eq('contact_id', filters.contactId)
  if (filters.leadId) taskQuery = taskQuery.eq('lead_id', filters.leadId)

  const [actResult, taskResult] = await Promise.all([actQuery, taskQuery])

  if (actResult.error) return { data: null, error: actResult.error }
  if (taskResult.error) return { data: null, error: taskResult.error }

  const items: TimelineItem[] = []

  actResult.data.forEach((act) => {
    items.push({
      id: act.id,
      type: 'activity',
      subType: act.type,
      content: act.content,
      createdAt: act.created_at,
      createdBy: (act.users as any)?.full_name || null,
    })
  })

  taskResult.data.forEach((task) => {
    items.push({
      id: task.id,
      type: 'task',
      subType: 'task',
      content: task.title,
      status: task.status,
      createdAt: task.created_at,
      createdBy: (task.creator as any)?.full_name || null,
      assignedTo: (task.assignee as any)?.full_name || null,
      completedAt: task.completed_at,
    })
  })

  // Sort descending by created_at
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return { data: items, error: null }
}
