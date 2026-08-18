import { z } from 'zod'

// ============================================================================
// CONTACTS
// ============================================================================

export const contactTypeEnum = z.enum(['residential', 'commercial'])

// Matches the DB's contact_method enum. A property of the person, not any
// single lead — a contact can have multiple leads over time.
export const contactMethodEnum = z.enum(['phone', 'email', 'text'])

export const insertContactSchema = z.object({
  type: contactTypeEnum.default('residential'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
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

export const insertAddressSchema = z.object({
  line_1: z.string().min(1, 'Address Line 1 is required'),
  line_2: z.string().optional().nullable(),
  city: z.string().min(1, 'City is required'),
  county: z.string().optional().nullable(),
  postcode: z.string().min(1, 'Postcode is required'),
  country: z.string().default('GB'),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  access_notes: z.string().optional().nullable(),
  floor_level: z.number().int().optional().nullable(),
  has_lift: z.boolean().optional().nullable(),
  parking_notes: z.string().optional().nullable(),
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
  estimated_hours: z.number().optional().nullable(),
  estimated_crew_size: z.number().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  
  // Addresses (Optional)
  origin_city: z.string().optional().nullable(),
  origin_postcode: z.string().optional().nullable(),
  destination_city: z.string().optional().nullable(),
  destination_postcode: z.string().optional().nullable(),
  
  // Quote
  quote_amount: z.number().optional().nullable(),
})

export type CreateClientFormInput = z.infer<typeof createClientFormSchema>
