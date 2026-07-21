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
  surcharges: z.array(surchargeSchema).default([]),
})

export type SurchargeInput = z.infer<typeof surchargeSchema>
export type PricingSettingsInput = z.infer<typeof pricingSettingsSchema>
