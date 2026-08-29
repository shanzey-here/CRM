import { z } from 'zod'

export const appointmentStatusEnum = z.enum(['scheduled', 'completed', 'cancelled'])

// DELIBERATE DECISION — no `type`/kind column on appointments (audited under
// feature/phase4-survey-concept-audit-and-data-model): the Kanban "Schedule
// Survey" action is the ONLY appointment-creating feature anywhere in the
// real, current codebase or the Phase 4 plan (PHASE4_SYSTEM_AUDIT.md and the
// 31-branch roadmap — Epic D is the sole appointment-related epic). Nothing
// today filters, queries, or renders appointments by kind: getAppointments()
// only filters by tenant/time range, the Unified Calendar's conflict engine
// (src/modules/calendar/conflict.ts) is purely time/assignee-based, and the
// generic appointment-creation UI (unified-creation-modal.tsx) has no
// purpose/kind field. Adding a column now would be speculative.
//
// When a second real appointment kind actually needs to exist (a sales
// call, a follow-up visit, etc.), add it here as a new field on
// baseAppointmentSchema — e.g. `appointment_type: appointmentTypeEnum`,
// following the same z.enum() pattern as appointmentStatusEnum above — plus
// a matching Postgres column. This app's convention for a small, real
// categorical DB column of this kind is a proper Postgres ENUM type (see
// `lead_stage`, `notification_type_enum`, `activity_type`), not free text —
// match that, not appointments.status's plain `text` column, which is an
// existing inconsistency, not the pattern to copy.
export const baseAppointmentSchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  start_time: z.string().datetime({ message: "Invalid start time" }),
  end_time: z.string().datetime({ message: "Invalid end time" }),
  status: appointmentStatusEnum.default('scheduled'),
})

export const insertAppointmentSchema = baseAppointmentSchema.refine((data) => {
  return new Date(data.end_time) > new Date(data.start_time)
}, {
  message: "End time must be after start time",
  path: ["end_time"]
})

export const updateAppointmentSchema = baseAppointmentSchema.partial().refine((data) => {
  if (data.start_time && data.end_time) {
    return new Date(data.end_time) > new Date(data.start_time)
  }
  return true
}, {
  message: "End time must be after start time",
  path: ["end_time"]
})

export const scheduleSurveyFormSchema = z.object({
  title: z.string().min(1, 'Survey title is required'),
  contact_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  description: z.string().optional().nullable(),
}).refine((data) => {
  if (!data.start_time || !data.end_time) return true
  return new Date(data.end_time).getTime() > new Date(data.start_time).getTime()
}, {
  message: "End time must be after start time",
  path: ["end_time"]
})

export type ScheduleSurveyFormInput = z.infer<typeof scheduleSurveyFormSchema>
export type InsertAppointmentInput = z.infer<typeof insertAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
