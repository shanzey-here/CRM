'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { brandFormSchema } from '@/modules/settings/brands/schemas'
import { createBrand, updateBrand } from '@/modules/settings/brands/server/repository'

async function requireTenantAdminOrDispatcher() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' as const }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' as const }
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    return { error: 'Forbidden' as const }
  }

  return { supabase, tenantId }
}

function formDataToBrandInput(formData: FormData) {
  return {
    name: formData.get('name') as string,
    logo_url: (formData.get('logo_url') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    address_line_1: (formData.get('address_line_1') as string) || null,
    address_line_2: (formData.get('address_line_2') as string) || null,
    address_city: (formData.get('address_city') as string) || null,
    address_county: (formData.get('address_county') as string) || null,
    address_postcode: (formData.get('address_postcode') as string) || null,
    address_country: (formData.get('address_country') as string) || null,
    vat_number: (formData.get('vat_number') as string) || null,
    bank_details: (formData.get('bank_details') as string) || null,
    terms_text: (formData.get('terms_text') as string) || null,
  }
}

export async function createBrandAction(formData: FormData) {
  const guard = await requireTenantAdminOrDispatcher()
  if ('error' in guard) throw new Error(guard.error)

  const parsed = brandFormSchema.safeParse(formDataToBrandInput(formData))
  if (!parsed.success) {
    throw new Error(`Validation error: ${parsed.error.message}`)
  }

  const { error } = await createBrand(guard.supabase, guard.tenantId, parsed.data)
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  revalidatePath('/office/settings/brands')
}

export async function updateBrandAction(brandId: string, formData: FormData) {
  const guard = await requireTenantAdminOrDispatcher()
  if ('error' in guard) throw new Error(guard.error)

  const parsed = brandFormSchema.safeParse(formDataToBrandInput(formData))
  if (!parsed.success) {
    throw new Error(`Validation error: ${parsed.error.message}`)
  }

  const { error } = await updateBrand(guard.supabase, guard.tenantId, brandId, parsed.data)
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  revalidatePath('/office/settings/brands')
}
