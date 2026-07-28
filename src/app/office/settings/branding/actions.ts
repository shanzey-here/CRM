'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { tenantSettingsSchema } from '@/modules/settings/branding/schemas'
import {
  getTenantSettings,
  updateTenantSettings,
  uploadTenantLogo,
} from '@/modules/settings/branding/server/repository'

export async function updateBrandingAction(formData: FormData) {
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

  // Parse form data
  const company_legal_name = formData.get('company_legal_name') as string | null
  const address_line_1 = formData.get('address_line_1') as string | null
  const address_line_2 = formData.get('address_line_2') as string | null
  const address_city = formData.get('address_city') as string | null
  const address_county = formData.get('address_county') as string | null
  const address_postcode = formData.get('address_postcode') as string | null
  const address_country = formData.get('address_country') as string | null
  const vat_number = formData.get('vat_number') as string | null
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  const website = formData.get('website') as string | null
  const terms_template = formData.get('terms_template') as string | null
  const primary_color = formData.get('primary_color') as string

  const parsed = tenantSettingsSchema.safeParse({
    company_legal_name: company_legal_name || null,
    address_line_1: address_line_1 || null,
    address_line_2: address_line_2 || null,
    address_city: address_city || null,
    address_county: address_county || null,
    address_postcode: address_postcode || null,
    address_country: address_country || null,
    vat_number: vat_number || null,
    phone: phone || null,
    email: email || null,
    website: website || null,
    terms_template: terms_template || null,
    primary_color,
  })

  if (!parsed.success) {
    throw new Error('Invalid input data')
  }

  const { error } = await updateTenantSettings(supabase, tenantId, parsed.data)
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  revalidatePath('/office/settings/branding')
}

export async function updateBrandingLogoUrlAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    return { error: 'No tenant context' }
  }

  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    return { error: 'Forbidden' }
  }

  const logoUrl = formData.get('logo_url') as string | null
  if (!logoUrl) {
    return { error: 'No URL provided' }
  }

  // Update tenant_settings.logo_url
  const { error: updateError } = await updateTenantSettings(supabase, tenantId, {
    logo_url: logoUrl,
  })

  if (updateError) {
    return { error: `Failed to save logo URL: ${updateError.message}` }
  }

  revalidatePath('/office/settings/branding')

  return { success: true, logoUrl }
}
