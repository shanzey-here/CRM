import { z } from 'zod'

export const VehicleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  type: z.string().nullable(),
  capacity_cubic: z.number().nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string().nullable()
})

export type Vehicle = z.infer<typeof VehicleSchema>

export const CreateVehicleSchema = VehicleSchema.pick({
  name: true,
  type: true,
  capacity_cubic: true,
  is_active: true
})

export type CreateVehicleData = z.infer<typeof CreateVehicleSchema>

export const UpdateVehicleSchema = CreateVehicleSchema.partial()

export type UpdateVehicleData = z.infer<typeof UpdateVehicleSchema>
