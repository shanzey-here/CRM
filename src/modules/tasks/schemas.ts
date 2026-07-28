import { z } from 'zod'

export const taskStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'cancelled'])
export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent'])

const baseTaskSchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  status: taskStatusEnum.default('pending'),
  priority: taskPriorityEnum.default('medium'),
})

export const insertTaskSchema = baseTaskSchema.refine(data => data.contact_id || data.lead_id, {
  message: 'Either contact_id or lead_id must be provided',
  path: ['contact_id'],
})

export const updateTaskSchema = baseTaskSchema.partial()

export type InsertTaskInput = z.infer<typeof insertTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
