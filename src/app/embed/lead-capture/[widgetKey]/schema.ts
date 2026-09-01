import { z } from 'zod'
import { optionalUkPostcodeSchema } from '@/lib/postcode-validation'

export const publicWidgetFormSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Please provide a valid email'),
  phone: z.string().min(1, 'Please provide a valid phone number'),
  origin_city: z.string().optional(),
  origin_postcode: optionalUkPostcodeSchema,
  destination_city: z.string().optional(),
  destination_postcode: optionalUkPostcodeSchema,
  preferred_move_date: z.string().optional(),
  notes: z.string().optional(),
  // Honeypot field
  website_url: z.string().optional()
})

export type PublicWidgetFormInput = z.infer<typeof publicWidgetFormSchema>
