'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createTask, updateTask } from '@/modules/tasks/server/repository'
import { emitEvent } from '@/utils/supabase/event-bus'
import { z } from 'zod'
import { InsertTaskInput } from '@/modules/tasks/schemas'

export async function createTaskAction(payload: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id

  // Validate the payload. If assigned_to is 'unassigned', we translate it to null
  const data = payload as any
  if (data.assigned_to === 'unassigned') {
    data.assigned_to = null
  }

  // The InsertTaskInput schema handles zod validation
  // However, we must ensure due_date is either string or undefined/null correctly
  const parsed = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    assigned_to: z.string().uuid().nullable().optional(),
    due_date: z.string().nullable().optional(),
    contact_id: z.string().uuid().nullable().optional(),
    lead_id: z.string().uuid().nullable().optional(),
  }).safeParse(data)

  if (!parsed.success) {
    return { success: false, error: 'Validation failed', details: parsed.error.issues }
  }

  const insertData = {
    ...parsed.data,
    created_by: user.id,
    status: 'pending' as const
  }

  const { data: taskData, error } = await createTask(supabase, tenantId, insertData)

  if (error || !taskData) {
    return { success: false, error: error?.message || 'Failed to create task' }
  }

  // We could emit a task.created event, but it was not requested explicitly. 
  // However, we will revalidate necessary paths.
  revalidatePath('/office/tasks')
  if (parsed.data.contact_id) {
    revalidatePath(`/office/clients/${parsed.data.contact_id}`)
  }
  if (parsed.data.lead_id) {
    revalidatePath(`/office/leads/${parsed.data.lead_id}`)
  }

  return { success: true }
}

export async function updateTaskStatusAction(taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'cancelled') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata?.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id

  const payload: any = { status }
  if (status === 'completed') {
    payload.completed_at = new Date().toISOString()
  }

  const { data, error } = await updateTask(supabase, tenantId, taskId, payload)

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to update task' }
  }

  if (status === 'completed') {
    await emitEvent(supabase, 'task.completed', 'crm', { task_id: taskId })
  }

  revalidatePath('/office/tasks')
  if (data.contact_id) {
    revalidatePath(`/office/clients/${data.contact_id}`)
  }
  if (data.lead_id) {
    revalidatePath(`/office/leads/${data.lead_id}`)
  }

  return { success: true }
}
