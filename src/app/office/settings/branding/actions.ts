'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { primaryColorSchema } from '@/modules/settings/branding/schemas'
import { updateTenantSettings } from '@/modules/settings/branding/server/repository'
import { brandFormSchema } from '@/modules/settings/brands/schemas'
import { updateBrand, getDefaultBrandId } from '@/modules/settings/brands/server/repository'

// "Branding" is a real edit surface for the tenant's DEFAULT BRAND
// specifically — not a second, independent data source. Editing here and
// editing the default brand's row on /office/settings/brands are two views
// of the exact same data, using the exact same updateBrand() the Brands
// page itself uses. primary_color is the one genuine exception: it's a
// tenant-wide customer-portal accent color, not brand identity, so it
// stays on tenant_settings and is saved separately below.
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

  const defaultBrandId = await getDefaultBrandId(supabase, tenantId)
  if (!defaultBrandId) {
    throw new Error('No default brand found for this tenant')
  }

  const brandInput = {
    name: (formData.get('company_legal_name') as string) || '',
    logo_url: (formData.get('logo_url') as string) || null,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    website: (formData.get('website') as string) || null,
    address_line_1: (formData.get('address_line_1') as string) || null,
    address_line_2: (formData.get('address_line_2') as string) || null,
    address_city: (formData.get('address_city') as string) || null,
    address_county: (formData.get('address_county') as string) || null,
    address_postcode: (formData.get('address_postcode') as string) || null,
    address_country: (formData.get('address_country') as string) || null,
    vat_number: (formData.get('vat_number') as string) || null,
    bank_details: null as string | null, // Not part of the Branding form — managed on Brands directly.
    terms_text: (formData.get('terms_template') as string) || null,
  }

  const parsedBrand = brandFormSchema.safeParse(brandInput)
  if (!parsedBrand.success) {
    throw new Error(`Invalid input: ${JSON.stringify(parsedBrand.error.flatten())}`)
  }

  // Preserve any bank_details already set on the brand (via the Brands
  // page) — the Branding form has no field for it, so it must never be
  // silently blanked out on save.
  const { data: existingBrand } = await supabase.from('brands').select('bank_details').eq('id', defaultBrandId).single()

  const { error: brandError } = await updateBrand(supabase, tenantId, defaultBrandId, {
    ...parsedBrand.data,
    bank_details: existingBrand?.bank_details ?? null,
  })
  if (brandError) {
    throw new Error(`Database error: ${brandError.message}`)
  }

  const primary_color = formData.get('primary_color') as string
  const parsedColor = primaryColorSchema.safeParse({ primary_color })
  if (!parsedColor.success) {
    throw new Error(`Invalid input: ${JSON.stringify(parsedColor.error.flatten())}`)
  }

  const { error: colorError } = await updateTenantSettings(supabase, tenantId, parsedColor.data)
  if (colorError) {
    throw new Error(`Database error: ${colorError.message}`)
  }

  revalidatePath('/office/settings/branding')
  revalidatePath('/office/settings/brands')
  revalidatePath('/office/settings/invoice-template')
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

  const defaultBrandId = await getDefaultBrandId(supabase, tenantId)
  if (!defaultBrandId) {
    return { error: 'No default brand found for this tenant' }
  }

  const { error: updateError } = await supabase
    .from('brands')
    .update({ logo_url: logoUrl })
    .eq('id', defaultBrandId)
    .eq('tenant_id', tenantId)

  if (updateError) {
    return { error: `Failed to save logo URL: ${updateError.message}` }
  }

  revalidatePath('/office/settings/branding')
  revalidatePath('/office/settings/brands')

  return { success: true, logoUrl }
}
