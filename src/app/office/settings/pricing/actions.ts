'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { pricingSettingsSchema } from '@/modules/settings/pricing/schemas'
import { updatePricingSettings } from '@/modules/settings/pricing/server/repository'

export async function updatePricingAction(formData: FormData) {
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

  // Parse rate fields
  const base_rate = formData.get('base_rate') as string
  const per_mile_rate = formData.get('per_mile_rate') as string
  const per_cubic_foot_rate = formData.get('per_cubic_foot_rate') as string
  const labor_hourly_rate = formData.get('labor_hourly_rate') as string
  const labour_hours_per_cubicft = formData.get('labour_hours_per_cubicft') as string

  // Parse surcharges JSON array
  let surcharges = []
  const surchargesJson = formData.get('surcharges') as string
  if (surchargesJson) {
    try {
      surcharges = JSON.parse(surchargesJson)
    } catch {
      throw new Error('Invalid surcharges format')
    }
  }

  const parsed = pricingSettingsSchema.safeParse({
    base_rate: Number(base_rate),
    per_mile_rate: Number(per_mile_rate),
    per_cubic_foot_rate: Number(per_cubic_foot_rate),
    labor_hourly_rate: Number(labor_hourly_rate),
    labour_hours_per_cubicft: Number(labour_hours_per_cubicft),
    surcharges,
  })

  if (!parsed.success) {
    throw new Error(`Validation error: ${parsed.error.message}`)
  }

  const { error } = await updatePricingSettings(supabase, tenantId, parsed.data)
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  revalidatePath('/office/settings/pricing')
}
