import { z } from 'zod'

export const tenantSettingsSchema = z.object({
  company_legal_name: z.string().nullable().optional(),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  address_county: z.string().nullable().optional(),
  address_postcode: z.string().nullable().optional(),
  address_country: z.string().default('GB'),
  vat_number: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  website: z.string().url().nullable().optional(),
  terms_template: z.string().nullable().optional(),
  primary_color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Primary color must be a valid hex color (e.g., #1a56db)')
    .default('#1a56db'),
  logo_url: z.string().url().nullable().optional(),
})

export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>
