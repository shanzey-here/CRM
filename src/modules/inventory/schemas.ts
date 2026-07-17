import { z } from 'zod'

export const INVENTORY_ROOMS = [
  'bedroom',
  'living_room',
  'dining_room',
  'kitchen',
  'bathroom',
  'office',
  'garage',
  'outdoor',
  'other'
] as const

export const insertInventoryItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  room: z.enum(INVENTORY_ROOMS).nullable().optional(),
  default_volume: z.coerce.number().positive('Volume must be a positive number'),
  is_active: z.boolean().default(true)
})

export const updateInventoryItemSchema = insertInventoryItemSchema.partial()

export type InsertInventoryInput = z.infer<typeof insertInventoryItemSchema>
export type UpdateInventoryInput = z.infer<typeof updateInventoryItemSchema>
