'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { tenantSettingsSchema } from '@/modules/settings/branding/schemas'
import { pricingSettingsSchema } from '@/modules/settings/pricing/schemas'
import {
  updateTenantSettings,
} from '@/modules/settings/branding/server/repository'
import { updatePricingSettings } from '@/modules/settings/pricing/server/repository'

/**
 * Wizard-specific branding action.
 *
 * WHY THIS EXISTS (do not remove without understanding this):
 * updateBrandingAction(formData) in settings/branding/actions.ts works correctly
 * when bound to a <form action={action}> — Next.js handles FormData natively.
 * But the onboarding wizard calls actions manually from a JS event handler
 * (handleBrandingSubmit), which causes Next.js to serialize arguments as JSON.
 * FormData is NOT JSON-serializable and arrives on the server as {}.
 * This action accepts a plain object instead — the correct pattern for
 * manually-invoked Server Actions.
 */
export async function updateBrandingWizardAction(input: {
  company_legal_name: string | null
  primary_color: string
}) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    throw new Error('Unauthorized')
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    throw new Error('No tenant context')
  }

  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden')
  }

  const parsed = tenantSettingsSchema.safeParse({
    company_legal_name: input.company_legal_name || null,
    primary_color: input.primary_color || '#1a56db',
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid branding input: ${JSON.stringify(parsed.error.flatten())}`
    )
  }

  const { error } = await updateTenantSettings(supabase, tenantId, parsed.data)
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  revalidatePath('/office/settings/branding')
}

/**
 * Wizard-specific pricing action.
 *
 * WHY THIS EXISTS: same reason as updateBrandingWizardAction above.
 * The wizard also only collects a subset of pricing fields (the core rates).
 * Fields not shown in the wizard (crate_overdue_rate_per_day, crate_lost_fee,
 * surcharges) are passed as safe zero/empty defaults — the schema allows 0
 * for crate rates specifically for this "not configured yet" state.
 */
export async function updatePricingWizardAction(input: {
  base_rate: number
  per_mile_rate: number
  per_cubic_foot_rate: number
  labor_hourly_rate: number
  labour_hours_per_cubicft: number
}) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    throw new Error('Unauthorized')
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    throw new Error('No tenant context')
  }

  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden')
  }

  const parsed = pricingSettingsSchema.safeParse({
    base_rate: input.base_rate,
    per_mile_rate: input.per_mile_rate,
    per_cubic_foot_rate: input.per_cubic_foot_rate,
    labor_hourly_rate: input.labor_hourly_rate,
    labour_hours_per_cubicft: input.labour_hours_per_cubicft,
    // Wizard doesn't collect crate fields; 0 is the schema's explicit
    // "not configured yet" sentinel — nonnegative() allows it.
    crate_overdue_rate_per_day: 0,
    crate_lost_fee: 0,
    surcharges: [],
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid pricing input: ${JSON.stringify(parsed.error.flatten())}`
    )
  }

  const { error } = await updatePricingSettings(supabase, tenantId, parsed.data)
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  revalidatePath('/office/settings/pricing')
}
