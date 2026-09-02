import { z } from 'zod'
import { ukPostcodeSchema, optionalUkPostcodeSchema } from '@/lib/postcode-validation'
import { leadPackingPreferenceEnum } from '@/modules/leads/schemas'

// ============================================================================
// CONTACTS
// ============================================================================

export const contactTypeEnum = z.enum(['residential', 'commercial'])

// Matches the DB's contact_method enum. A property of the person, not any
// single lead — a contact can have multiple leads over time.
export const contactMethodEnum = z.enum(['phone', 'email', 'text'])

export const contactTitleEnum = z.enum(['Mr', 'Mrs', 'Miss', 'Dr', 'Prof'])

export const insertContactSchema = z.object({
  type: contactTypeEnum.default('residential'),
  title: contactTitleEnum.optional().nullable(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  alt_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  preferred_contact_method: contactMethodEnum.optional().nullable(),
  best_time_to_call: z.string().optional().nullable(),
})

export const updateContactSchema = insertContactSchema.partial()

export type InsertContactInput = z.infer<typeof insertContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>

// ============================================================================
// ADDRESSES
// ============================================================================

// Matches the widget's Property Type radio field exactly (House/Flat/
// Office/Storage/Shop). A property of the physical address, so it lives
// here rather than as a pair of origin/destination columns on leads.
export const addressPropertyTypeEnum = z.enum(['house', 'flat', 'office', 'storage', 'shop'])

export const insertAddressSchema = z.object({
  line_1: z.string().min(1, 'Address Line 1 is required'),
  line_2: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  county: z.string().optional().nullable(),
  postcode: ukPostcodeSchema,
  country: z.string().default('GB'),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  access_notes: z.string().optional().nullable(),
  floor_level: z.number().int().optional().nullable(),
  has_lift: z.boolean().optional().nullable(),
  parking_notes: z.string().optional().nullable(),
  property_type: addressPropertyTypeEnum.optional().nullable(),
})

export const updateAddressSchema = insertAddressSchema.partial()

export type InsertAddressInput = z.infer<typeof insertAddressSchema>
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>

// ============================================================================
// CONTACT PRICING OVERRIDES (negotiated rates)
// ============================================================================

export const contactPricingOverrideSchema = z.object({
  discount_percent: z.coerce.number().positive('Discount must be greater than 0').max(100, 'Discount cannot exceed 100%'),
  notes: z.string().optional().nullable(),
})

export type ContactPricingOverrideInput = z.infer<typeof contactPricingOverrideSchema>

// ============================================================================
// CREATE CLIENT FORM
// ============================================================================

export const createClientFormSchema = z.object({
  // Contact info
  title: contactTitleEnum.optional().nullable(),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  type: z.enum(['residential', 'commercial']).default('residential'),

  // Only meaningful when the tenant has more than one brand — the form
  // hides this field entirely for single-brand tenants, and the server
  // resolves the tenant's default brand when omitted.
  brand_id: z.string().uuid().optional().nullable(),

  // Optional lead details
  stage: z.enum(['inquiry', 'survey_scheduled', 'quote_sent', 'follow_up', 'confirmed_booking', 'completed', 'archived']).optional(),
  preferred_move_date: z.string().optional().nullable(),
  preferred_move_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Enter a valid time')
    .optional()
    .nullable()
    .or(z.literal('')),
  packing_preference: leadPackingPreferenceEnum.optional().nullable(),
  estimated_hours: z.number().optional().nullable(),
  estimated_crew_size: z.number().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Addresses (Optional) — house number/property type are only meaningful
  // once a city+postcode is present (the widget requires all four together;
  // the internal manual Create Client form still only asks for city+postcode
  // and leaves these two null, matching its existing minimal behaviour).
  origin_house_number: z.string().optional().nullable(),
  origin_city: z.string().optional().nullable(),
  origin_postcode: optionalUkPostcodeSchema,
  origin_property_type: addressPropertyTypeEnum.optional().nullable(),
  destination_house_number: z.string().optional().nullable(),
  destination_city: z.string().optional().nullable(),
  destination_postcode: optionalUkPostcodeSchema,
  destination_property_type: addressPropertyTypeEnum.optional().nullable(),

  // Quote
  quote_amount: z.number().optional().nullable(),
})

export type CreateClientFormInput = z.infer<typeof createClientFormSchema>
