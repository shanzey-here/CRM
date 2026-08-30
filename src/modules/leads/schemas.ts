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

// Matches the DB's priority_level enum (shared with tasks.priority). A
// lightweight triage signal, deliberately not a monetary value — that's
// what the quote's own snapshotted price is for.
export const leadPriorityEnum = z.enum(['low', 'medium', 'high'])

export const insertLeadSchema = z.object({
  contact_id: z.string().uuid('A valid contact is required'),
  // Optional at the form/payload layer: a tenant with only one brand never
  // shows a selector, and the server resolves that tenant's default brand
  // when this is omitted (see getDefaultBrandId). A tenant with multiple
  // brands must show a selector and pass this explicitly.
  brand_id: z.string().uuid().optional(),
  stage: leadStageEnum.default('inquiry'),
  source: z.string().optional().nullable(),
  preferred_move_date: z.string().optional().nullable(),
  origin_address_id: z.string().uuid().optional().nullable(),
  destination_address_id: z.string().uuid().optional().nullable(),
  estimated_volume: z.number().optional().nullable(),
  estimated_hours: z.number().optional().nullable(),
  estimated_crew_size: z.number().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  priority: leadPriorityEnum.optional(),
})

export const updateLeadSchema = insertLeadSchema.partial()

export type InsertLeadInput = z.infer<typeof insertLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>

// ============================================================================
// FOLLOW UP (Epic F) — manual, action-based. See PHASE4_FOLLOW_UP_DECISION.md.
// A staff member logs a follow-up they just performed; that logged action is
// what moves the lead to `follow_up`. Captures a note + how they made contact
// + an optional date to be reminded to follow up again.
// ============================================================================

// Re-declared here (not imported from clients/schemas) to keep the leads
// module self-contained, but the VALUES are the shared DB `contact_method`
// enum — phone / email / text — exactly as `contacts.preferred_contact_method`
// uses them. Do not diverge these.
export const followUpContactMethodEnum = z.enum(['phone', 'email', 'text'])

export const followUpFormSchema = z.object({
  note: z.string().trim().min(1, 'A note is required — record what happened'),
  contact_method: followUpContactMethodEnum,
  // Optional: a follow-up doesn't always warrant another reminder (lead just
  // converted, or went cold for good). Date-only string (YYYY-MM-DD) from the
  // <input type="date">; the server normalises it to an ISO datetime for the
  // tasks table. Empty string is treated as "no reminder".
  reminder_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date')
    .optional()
    .nullable()
    .or(z.literal('')),
})

export type FollowUpFormInput = z.infer<typeof followUpFormSchema>

// ============================================================================
// CONFIRM BOOKING (Epic G) — full conversion. See PHASE4_CONFIRM_BOOKING_DECISION.md.
// For a booking closed OUTSIDE the online proposal flow. The action reuses the
// existing createManualJobAction (→ create_manual_job_transaction: real job +
// draft invoice), then moves the lead to `confirmed_booking`.
//
// Only fields with NO lead source are collected fresh: title, one summary line
// item, and (when the lead has no address on file) origin/destination
// city+postcode. Contact, brand and move date come off the lead.
// `*_on_file` are hidden flags the form sets from the lead so the schema can
// require the address text only when it isn't already captured.
// ============================================================================
// Field-level shape only. The "address required when the lead has none on file"
// rule is conditional on lead data the schema can't see, so it is enforced
// authoritatively in confirmBookingAction (and mirrored as a client-side guard
// in the form). Keeps zodResolver mapping to a clean object.
export const confirmBookingFormSchema = z.object({
  title: z.string().trim().min(1, 'A job title is required'),
  move_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid move date'),
  line_item_description: z.string().trim().min(1, 'Describe the agreed work'),
  // registered with valueAsNumber → empty field arrives as NaN, which
  // z.number() rejects (shows the message) rather than silently coercing to 0.
  agreed_price: z.number({ message: 'Enter the agreed price' }).min(0, 'Price must be zero or more'),
  origin_city: z.string().trim(),
  origin_postcode: z.string().trim(),
  destination_city: z.string().trim(),
  destination_postcode: z.string().trim(),
})

export type ConfirmBookingFormInput = z.infer<typeof confirmBookingFormSchema>

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

// ============================================================================
// LEAD DETAILS EDIT (excludes stage, contact_id, addresses — read-only)
// ============================================================================
// Partial schema for editing lead metadata without touching stage/contact/addresses.
// Stage changes go through updateLeadStage action exclusively (the Kanban board uses it).
export const updateLeadDetailsSchema = z.object({
  notes: z.string().optional().nullable(),
  preferred_move_date: z.string().optional().nullable(),
  estimated_volume: z.number().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  source: z.string().optional().nullable(),
  priority: leadPriorityEnum.optional(),
})

export type UpdateLeadDetailsInput = z.infer<typeof updateLeadDetailsSchema>
