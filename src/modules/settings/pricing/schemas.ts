import { z } from 'zod'

export const surchargeSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  label: z.string().min(1, 'Label is required'),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  type: z.literal('fixed'),
})

export const pricingSettingsSchema = z.object({
  base_rate: z.coerce.number().positive('Base rate must be a positive number'),
  per_mile_rate: z.coerce.number().positive('Per-mile rate must be a positive number'),
  per_cubic_foot_rate: z.coerce.number().positive('Per-cubic-foot rate must be a positive number'),
  labor_hourly_rate: z.coerce.number().positive('Labor hourly rate must be a positive number'),
  labour_hours_per_cubicft: z.coerce.number().positive('Labor hours per cubic foot must be a positive number'),
  // Deliberately .nonnegative(), not .positive() like every rate above —
  // 0 means "not configured yet", and the crate-billing sweep treats 0 as
  // "skip this charge type for this tenant" rather than ever charging an
  // invented price. A tenant who hasn't decided on a rate must be able to
  // save the form with these left at 0.
  crate_overdue_rate_per_day: z.coerce.number().nonnegative('Crate overdue rate cannot be negative'),
  crate_lost_fee: z.coerce.number().nonnegative('Crate lost fee cannot be negative'),
  surcharges: z.array(surchargeSchema).default([]),
})

export type SurchargeInput = z.infer<typeof surchargeSchema>
export type PricingSettingsInput = z.infer<typeof pricingSettingsSchema>
