import { z } from 'zod'
import { ukPostcodeSchema } from '@/lib/postcode-validation'
import { contactTitleEnum } from '@/modules/clients/schemas'
import { addressPropertyTypeEnum } from '@/modules/clients/schemas'
import { leadPackingPreferenceEnum } from '@/modules/leads/schemas'

// Field names deliberately match createClientFormSchema exactly —
// publicCaptureAction passes this parsed data straight into createClientCore
// as its payload, so there is no separate mapping layer to keep in sync.
export const publicWidgetFormSchema = z.object({
  title: contactTitleEnum.optional(),
  first_name: z.string().trim().min(1, 'Full name is required'),
  last_name: z.string().optional(),
  email: z.string().trim().email('Please provide a valid email address'),
  phone: z.string().trim().min(1, 'Please provide a valid phone number'),

  preferred_move_date: z.string().trim().min(1, 'Moving date is required'),
  preferred_move_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Enter a valid time')
    .optional()
    .or(z.literal('')),

  origin_house_number: z.string().trim().min(1, 'House number is required'),
  origin_city: z.string().trim().min(1, 'City is required'),
  origin_postcode: ukPostcodeSchema,
  origin_property_type: addressPropertyTypeEnum,

  destination_house_number: z.string().trim().min(1, 'House number is required'),
  destination_city: z.string().trim().min(1, 'City is required'),
  destination_postcode: ukPostcodeSchema,
  destination_property_type: addressPropertyTypeEnum,

  packing_preference: leadPackingPreferenceEnum.optional(),
  notes: z.string().optional(),

  // Honeypot field
  website_url: z.string().optional(),
})

export type PublicWidgetFormInput = z.infer<typeof publicWidgetFormSchema>
