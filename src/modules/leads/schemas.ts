import { z } from 'zod'

// ============================================================================
// LEADS
// ============================================================================

export const leadStageEnum = z.enum([
  'inquiry',
  'survey_scheduled',
  'quote_sent',
  'follow_up',
  'confirmed_booking',
  'completed',
  'archived',
])

export const insertLeadSchema = z.object({
  contact_id: z.string().uuid('A valid contact is required'),
  stage: leadStageEnum.default('inquiry'),
  source: z.string().optional().nullable(),
  preferred_move_date: z.string().optional().nullable(),
  origin_address_id: z.string().uuid().optional().nullable(),
  destination_address_id: z.string().uuid().optional().nullable(),
  estimated_volume: z.number().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const updateLeadSchema = insertLeadSchema.partial()

export type InsertLeadInput = z.infer<typeof insertLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
