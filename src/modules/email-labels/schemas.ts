import { z } from 'zod'

export const emailLabelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60, 'Name is too long'),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #3B82F6)'),
})

export type EmailLabelInput = z.infer<typeof emailLabelSchema>
