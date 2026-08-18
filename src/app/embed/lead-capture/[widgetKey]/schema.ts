import { z } from 'zod'

export const publicWidgetFormSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email('Please provide a valid email'),
  phone: z.string().min(1, 'Please provide a valid phone number'),
  origin_city: z.string().optional(),
  origin_postcode: z.string().optional(),
  destination_city: z.string().optional(),
  destination_postcode: z.string().optional(),
  preferred_move_date: z.string().optional(),
  notes: z.string().optional(),
  // Honeypot field
  website_url: z.string().optional()
})

export type PublicWidgetFormInput = z.infer<typeof publicWidgetFormSchema>
