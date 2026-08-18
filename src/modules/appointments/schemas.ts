import { z } from 'zod'

export const appointmentStatusEnum = z.enum(['scheduled', 'completed', 'cancelled'])

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

export type InsertAppointmentInput = z.infer<typeof insertAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
