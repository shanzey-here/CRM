import { z } from 'zod'

// ============================================================================
// ACTIVITIES
// ============================================================================

export const activityTypeEnum = z.enum(['note', 'call', 'email', 'stage_change', 'system'])

export const insertActivitySchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  lead_id: z.string().uuid().optional().nullable(),
  type: activityTypeEnum,
  content: z.string().min(1, 'Content is required'),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
}).refine(data => data.contact_id || data.lead_id, {
  message: 'Either contact_id or lead_id must be provided',
  path: ['contact_id'], // attach error to contact_id
})

export const updateActivitySchema = z.object({
  content: z.string().min(1, 'Content is required').optional(),
  metadata: z.record(z.string(), z.any()).optional().nullable(),
})

export type InsertActivityInput = z.infer<typeof insertActivitySchema>
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>


