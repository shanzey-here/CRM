import { z } from 'zod'

export const createStorageUnitSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required').max(100),
  capacityCubicFeet: z.coerce.number().positive('Capacity must be a positive number'),
  locationNotes: z.string().max(1000).optional(),
})

export type CreateStorageUnitInput = z.infer<typeof createStorageUnitSchema>

export const updateStorageUnitSchema = z.object({
  unitNumber: z.string().min(1, 'Unit number is required').max(100).optional(),
  capacityCubicFeet: z.coerce.number().positive('Capacity must be a positive number').optional(),
  isAvailable: z.coerce.boolean().optional(),
  locationNotes: z.string().max(1000).optional(),
})

export const createCrateSchema = z.object({
  crateNumber: z.string().min(1, 'Crate number is required').max(100),
  storageUnitId: z.string().uuid().optional(),
})

export type CreateCrateInput = z.infer<typeof createCrateSchema>
