'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertQuoteSchema, saveQuoteInventorySchema } from '@/modules/quotes/schemas'
import { createQuote as repoCreateQuote, saveQuoteInventory as repoSaveQuoteInventory } from '@/modules/quotes/server/repository'

export async function createQuoteAction(payload: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id

  const parsed = insertQuoteSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed' }
  }

  const { data, error } = await repoCreateQuote(supabase, tenantId, parsed.data)

  if (error || !data) {
    return { success: false, error: 'Failed to create quote' }
  }

  revalidatePath(`/office/leads/${parsed.data.lead_id}`)
  return { success: true, quoteId: data.id }
}

export async function saveQuoteInventoryAction(quoteId: string, payload: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id

  const parsed = saveQuoteInventorySchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', details: parsed.error.issues }
  }

  const result = await repoSaveQuoteInventory(supabase, tenantId, quoteId, parsed.data.items)

  if (!result.success) {
    return { success: false, error: result.error || 'Failed to save inventory' }
  }

  revalidatePath(`/office/quotes/${quoteId}`)
  return { success: true }
}

export async function saveQuoteRouteAction(quoteId: string, payload: { travel_distance_miles: number, travel_time_minutes: number }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id

  // Enforce quote is draft
  const { data: quote } = await supabase.from('quotes').select('status').eq('id', quoteId).eq('tenant_id', tenantId).single()
  if (!quote || quote.status !== 'draft') {
    return { success: false, error: 'Quote is not in draft status' }
  }

  const { error } = await supabase
    .from('quotes')
    .update({
      travel_distance_miles: payload.travel_distance_miles,
      travel_time_minutes: payload.travel_time_minutes
    })
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/office/quotes/${quoteId}`)
  return { success: true }
}
