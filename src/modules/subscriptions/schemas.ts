import { z } from 'zod'

export const saasPlanSchema = z.object({
  id: z.string().uuid().optional(),
  stripe_product_id: z.string().nullable().optional(),
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullable().optional(),
  entitlements: z.record(z.any()).default({}), // e.g., { max_users: 5, max_leads: 100 }
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().nullable().optional()
})

export type SaasPlan = z.infer<typeof saasPlanSchema>

export const saasPricingIntervalSchema = z.enum(['month', 'year'])
export type SaasPricingInterval = z.infer<typeof saasPricingIntervalSchema>

export const saasPriceSchema = z.object({
  id: z.string().uuid().optional(),
  stripe_price_id: z.string().min(1),
  plan_id: z.string().uuid(),
  unit_amount: z.number().int().min(0).nullable().optional(),
  currency: z.string().default('usd'),
  interval: saasPricingIntervalSchema.nullable().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().nullable().optional()
})

export type SaasPrice = z.infer<typeof saasPriceSchema>

export const tenantSubscriptionSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid(),
  stripe_subscription_id: z.string().nullable().optional(),
  status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'cancelled']).default('trialing'),
  price_id: z.string().uuid().nullable().optional(),
  current_period_end: z.string().datetime().nullable().optional(),
  cancel_at_period_end: z.boolean().default(false),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().nullable().optional()
})

export type TenantSubscription = z.infer<typeof tenantSubscriptionSchema>
