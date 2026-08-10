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

  // 4. Revalidate exact paths — also the leads section, since this action is
  // now reachable from the Lead detail page's Contact Info card too.
  revalidatePath(`/office/clients/${id}`)
  revalidatePath('/office/clients')
  revalidatePath('/office/leads', 'layout')

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

import { createContact, createAddress } from '@/modules/clients/server/repository'
import { createLead } from '@/modules/leads/server/repository'
import { createQuote } from '@/modules/quotes/server/repository'
import { createClientFormSchema, type CreateClientFormInput } from '@/modules/clients/schemas'

export async function createClientCore(
  supabase: any,
  tenantId: string,
  payload: CreateClientFormInput,
  userId?: string,
  forceCreateLead?: boolean
) {
  // Validate payload
  const parseResult = createClientFormSchema.safeParse(payload)
  if (!parseResult.success) {
    return { error: 'Validation failed.', issues: parseResult.error.issues }
  }

  const data = parseResult.data

  // 1. Create the Contact
  const { data: contact, error: contactErr } = await createContact(supabase, tenantId, {
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    phone: data.phone,
    type: data.type,
    company_name: data.company_name,
  })

  if (contactErr || !contact) {
    console.error('Create Contact Error:', contactErr)
    return { error: contactErr?.message || 'Failed to create contact' }
  }

  // 2. If Lead details are provided (any of the optional fields), create a Lead
  const hasLeadData = forceCreateLead || !!(
    data.source ||
    data.preferred_move_date || 
    data.estimated_hours || 
    data.estimated_crew_size || 
    data.notes ||
    data.quote_amount ||
    data.origin_city || data.origin_postcode ||
    data.destination_city || data.destination_postcode
  )
  
  if (hasLeadData) {
    let origin_address_id: string | null = null
    let destination_address_id: string | null = null

    // 2a. Create Addresses if provided
    if (data.origin_city || data.origin_postcode) {
      const { data: originData } = await createAddress(supabase, tenantId, {
        line_1: '-', // Form doesn't ask for it, but it's required in schema
        city: data.origin_city || '-',
        postcode: data.origin_postcode || '-'
      })
      if (originData) origin_address_id = originData.id
    }

    if (data.destination_city || data.destination_postcode) {
      const { data: destData } = await createAddress(supabase, tenantId, {
        line_1: '-',
        city: data.destination_city || '-',
        postcode: data.destination_postcode || '-'
      })
      if (destData) destination_address_id = destData.id
    }

    // 2b. Create the Lead
    const { data: leadData, error: leadErr } = await createLead(supabase, tenantId, {
      contact_id: contact.id,
      stage: data.stage || 'inquiry',
      source: data.source || 'manual',
      preferred_move_date: data.preferred_move_date,
      estimated_hours: data.estimated_hours,
      estimated_crew_size: data.estimated_crew_size,
      notes: data.notes,
      assigned_to: userId,
      origin_address_id,
      destination_address_id
    })

    if (leadErr || !leadData) {
      console.error('Create Lead Error during Client creation:', leadErr)
    } else if (data.quote_amount != null) {
      // 2c. Create the Quote if amount provided
      const { error: quoteErr } = await createQuote(supabase, tenantId, {
        contact_id: contact.id,
        lead_id: leadData.id,
        final_price: data.quote_amount,
        total_price: data.quote_amount
      })
      if (quoteErr) {
        console.error('Create Quote Error during Client creation:', quoteErr)
      }
    }
  }

  return { success: true, contactId: contact.id }
}

export async function createClientAction(payload: CreateClientFormInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { error: 'Unauthorized. Missing tenant context.' }
  }
  const tenantId = user.app_metadata.tenant_id

  const result = await createClientCore(supabase, tenantId, payload, user.id, false)
  if (result.success) {
    revalidatePath('/office/clients')
  }
  return result
}
