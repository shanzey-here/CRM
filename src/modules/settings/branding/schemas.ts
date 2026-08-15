import { z } from 'zod'

// tenant_settings' only remaining genuinely tenant-wide (not brand-identity)
// setting after Branding was unified with Brands — the customer-portal
// accent color, shared across however many brands a tenant runs.
export const primaryColorSchema = z.object({
  primary_color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Primary color must be a valid hex color (e.g., #1a56db)')
    .default('#1a56db'),
})

export type PrimaryColorInput = z.infer<typeof primaryColorSchema>
