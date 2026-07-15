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

// ============================================================================
// PUBLIC LEAD-CAPTURE FORM SUBMISSION
// ============================================================================
// Deliberately its own schema, not a reuse of insertLeadSchema — the public
// payload shape is contact fields + lead notes, not a lead row directly.
// tenant_id/contact_id/stage/source are never accepted from the client: they
// aren't declared here, and zod's default "strip unknown keys" behavior on
// .safeParse() silently drops anything else the client sends (including a
// spoofed tenant_id), so there's nothing extra required to enforce that.
export const publicLeadSubmissionSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional(),
  email: z.string().email('A valid email is required'),
  phone: z.string().optional(),
  preferred_move_date: z.string().optional(),
  notes: z.string().optional(),
  // Honeypot: a hidden field real visitors never see or fill. Deliberately
  // not validated/rejected here — a filled value is handled as a silent
  // "pretend success" in the route, not a validation error, so a bot never
  // learns it tripped anything.
  company_website: z.string().optional(),
})

export type PublicLeadSubmissionInput = z.infer<typeof publicLeadSubmissionSchema>
