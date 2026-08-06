import { z } from 'zod'
import { type InvoicePlan } from '@/modules/invoicing/server/plan'

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
  stripe_payment_intent_id: z.string().nullable().optional(),
})

export type CreateJobFromQuoteData = z.infer<typeof CreateJobFromQuoteSchema> & {
  invoicePlan: InvoicePlan
}

// ============================================================================
// JOB DETAILS EDIT (excludes status, contact, quote, addresses — read-only /
// managed through their own dedicated flows elsewhere)
// ============================================================================
// internal_notes: dispatcher-facing special instructions (e.g. "narrow
// driveway, use smaller van"), separate from the quote's own notes.
// customer_notes: post-job outcome/feedback notes, recorded after
// completion — distinct from job_signoffs' legal signature capture.
export const updateJobDetailsSchema = z.object({
  internal_notes: z.string().optional().nullable(),
  customer_notes: z.string().optional().nullable(),
})

export type UpdateJobDetailsInput = z.infer<typeof updateJobDetailsSchema>
