import { z } from 'zod'

export const JobStatusEnum = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled'])
export type JobStatus = z.infer<typeof JobStatusEnum>

export const JobSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  quote_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid(),
  status: JobStatusEnum,
  move_date: z.string().nullable().optional(), // 'YYYY-MM-DD'
  origin_address_id: z.string().uuid().nullable().optional(),
  destination_address_id: z.string().uuid().nullable().optional(),
  customer_notes: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
  updated_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string().nullable().optional()
})

export type Job = z.infer<typeof JobSchema>

export const CreateJobFromQuoteSchema = z.object({
  quote_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid(),
  move_date: z.string().nullable().optional(),
  origin_address_id: z.string().uuid().nullable().optional(),
  destination_address_id: z.string().uuid().nullable().optional(),
})

export type CreateJobFromQuoteData = z.infer<typeof CreateJobFromQuoteSchema>
