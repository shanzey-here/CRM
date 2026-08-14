import { z } from 'zod'

// The identity fields a brand carries. This exact key set is what
// internal_create_invoice_snapshot() writes into invoices.brand_snapshot
// (jsonb_build_object with these same names) — so a live `brands` row and a
// frozen snapshot share one shape and one renderer, with zero translation
// layer between "editing a brand" and "viewing an already-issued invoice".
export const brandIdentitySchema = z.object({
  name: z.string().nullable(),
  logo_url: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  address_line_1: z.string().nullable(),
  address_line_2: z.string().nullable(),
  address_city: z.string().nullable(),
  address_county: z.string().nullable(),
  address_postcode: z.string().nullable(),
  address_country: z.string().nullable(),
  vat_number: z.string().nullable(),
  bank_details: z.string().nullable(),
  terms_text: z.string().nullable(),
})

export type BrandIdentity = z.infer<typeof brandIdentitySchema>

// The editable form shape — name is required (a brand must be named to be
// distinguishable in selectors), everything else optional/nullable like the
// existing Branding settings form.
export const brandFormSchema = z.object({
  name: z.string().min(1, 'Brand name is required'),
  logo_url: z.string().url().nullable().optional().or(z.literal('')),
  email: z.string().email().nullable().optional().or(z.literal('')),
  phone: z.string().nullable().optional(),
  address_line_1: z.string().nullable().optional(),
  address_line_2: z.string().nullable().optional(),
  address_city: z.string().nullable().optional(),
  address_county: z.string().nullable().optional(),
  address_postcode: z.string().nullable().optional(),
  address_country: z.string().nullable().optional(),
  vat_number: z.string().nullable().optional(),
  bank_details: z.string().nullable().optional(),
  terms_text: z.string().nullable().optional(),
})

export type BrandFormInput = z.infer<typeof brandFormSchema>
