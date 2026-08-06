import { z } from 'zod'

export const JobCrewAssignmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  job_id: z.string().uuid(),
  user_id: z.string().uuid(),
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable()
})

export type JobCrewAssignment = z.infer<typeof JobCrewAssignmentSchema>

export const CreateJobCrewAssignmentSchema = JobCrewAssignmentSchema.pick({
  job_id: true,
  user_id: true,
  scheduled_start: true,
  scheduled_end: true,
  notes: true
}).partial({ notes: true })

export type CreateJobCrewAssignmentData = z.infer<typeof CreateJobCrewAssignmentSchema>

// Real, actual timing — distinct from scheduled_start/scheduled_end (the
// plan). Both optional/nullable: a dispatcher may only know the actual start
// while a job is still in progress, or record neither if it ran exactly to plan.
export const updateJobCrewActualTimesSchema = z.object({
  actual_start: z.string().datetime().optional().nullable(),
  actual_end: z.string().datetime().optional().nullable(),
})

export type UpdateJobCrewActualTimesInput = z.infer<typeof updateJobCrewActualTimesSchema>

export const JobVehicleAssignmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  job_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable()
})

export type JobVehicleAssignment = z.infer<typeof JobVehicleAssignmentSchema>

export const CreateJobVehicleAssignmentSchema = JobVehicleAssignmentSchema.pick({
  job_id: true,
  vehicle_id: true,
  scheduled_start: true,
  scheduled_end: true,
  notes: true
}).partial({ notes: true })

export type CreateJobVehicleAssignmentData = z.infer<typeof CreateJobVehicleAssignmentSchema>
