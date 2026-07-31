import { z } from 'zod'

// ============================================================================
// CONTACTS
// ============================================================================

export const contactTypeEnum = z.enum(['residential', 'commercial'])

export const insertContactSchema = z.object({
  type: contactTypeEnum.default('residential'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable(),
  phone: z.string().optional().nullable(),
  alt_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
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
