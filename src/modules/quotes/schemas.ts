import { z } from 'zod'
import { INVENTORY_ROOMS } from '../inventory/schemas'

export const insertQuoteSchema = z.object({
  lead_id: z.string().uuid().optional(),
  contact_id: z.string().uuid(),
})

export type InsertQuoteInput = z.infer<typeof insertQuoteSchema>

export const quoteInventoryItemSchema = z.object({
  inventory_item_id: z.string().uuid(),
  room: z.enum(INVENTORY_ROOMS),
  quantity: z.coerce.number().int().positive(),
  item_name: z.string().min(1, 'Item name is required'),
  volume: z.coerce.number().positive(), // This is the base volume of the item
})

export type QuoteInventoryItemInput = z.infer<typeof quoteInventoryItemSchema>

export const saveQuoteInventorySchema = z.object({
  items: z.array(quoteInventoryItemSchema),
})
