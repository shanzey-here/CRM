'use server'

import { createClient } from '@/lib/supabase/server'
import { updateContact } from '@/modules/clients/server/repository'
import { upsertContactPricingOverride, setContactPricingOverrideActive } from '@/modules/clients/server/pricing-overrides'
import { UpdateContactInput, updateContactSchema, ContactPricingOverrideInput, contactPricingOverrideSchema } from '@/modules/clients/schemas'
import { revalidatePath } from 'next/cache'

export async function updateContactAction(id: string, payload: UpdateContactInput) {
  // 1. Authenticate and extract Tenant ID
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { error: 'Unauthorized. Missing tenant context.' }
  }

  const tenantId = user.app_metadata.tenant_id

  // 2. Validate Payload (Defense in depth)
  const parseResult = updateContactSchema.safeParse(payload)
  if (!parseResult.success) {
    return { error: 'Validation failed.', issues: parseResult.error.issues }
  }

  // 3. Perform Update
  const { data, error } = await updateContact(supabase, tenantId, id, parseResult.data)

  if (error) {
    console.error('Update Contact Error:', error)
    return { error: error.message }
  }

  // 4. Revalidate exact paths
  revalidatePath(`/office/clients/${id}`)
  revalidatePath('/office/clients')

  return { success: true, data }
}

// A customer-specific commercial concession — same weight class as staff
// management and billing, both tenant_admin-only in this codebase. Not the
// dispatcher-accessible pattern used by the tenant's own pricing_settings.
export async function setContactPricingOverrideAction(contactId: string, payload: ContactPricingOverrideInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { error: 'Unauthorized. Missing tenant context.' }
  }
  const tenantId = user.app_metadata.tenant_id

  // HARD GUARD: only tenant_admin can set a contact's negotiated rate
  const tenantRole = user.app_metadata?.tenant_role
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Only tenant admins can set a negotiated rate' }
  }

  const parseResult = contactPricingOverrideSchema.safeParse(payload)
  if (!parseResult.success) {
    return { error: 'Validation failed.', issues: parseResult.error.issues }
  }

  const { data, error } = await upsertContactPricingOverride(supabase, tenantId, contactId, parseResult.data, user.id)
  if (error) {
    console.error('Set Contact Pricing Override Error:', error)
    return { error: error.message }
  }

  revalidatePath(`/office/clients/${contactId}`)
  return { success: true, data }
}

export async function deactivateContactPricingOverrideAction(contactId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { error: 'Unauthorized. Missing tenant context.' }
  }
  const tenantId = user.app_metadata.tenant_id

  // HARD GUARD: only tenant_admin can deactivate a contact's negotiated rate
  const tenantRole = user.app_metadata?.tenant_role
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Only tenant admins can deactivate a negotiated rate' }
  }

  const { data, error } = await setContactPricingOverrideActive(supabase, tenantId, contactId, false)
  if (error) {
    console.error('Deactivate Contact Pricing Override Error:', error)
    return { error: error.message }
  }

  revalidatePath(`/office/clients/${contactId}`)
  return { success: true, data }
}
