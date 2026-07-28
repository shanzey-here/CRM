import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InsertQuoteInput, QuoteInventoryItemInput } from '../schemas'

export async function createQuote(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: InsertQuoteInput
) {
  return await supabase
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      contact_id: input.contact_id,
      lead_id: input.lead_id,
      status: 'draft',
      total_volume: 0,
      subtotal: 0,
      surcharge_total: 0,
      total_price: 0,
    })
    .select()
    .single()
}

export async function getQuotesForLead(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  leadId: string
) {
  return await supabase
    .from('quotes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
}

export async function getQuoteById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string
) {
  return await supabase
    .from('quotes')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .single()
}

export async function getQuoteInventory(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string
) {
  return await supabase
    .from('quote_inventory')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('quote_id', quoteId)
}

export async function saveQuoteInventory(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
  items: QuoteInventoryItemInput[]
) {
  // Call the atomic RPC to safely batch upsert and validate status
  const { error } = await supabase.rpc('save_quote_inventory', {
    p_tenant_id: tenantId,
    p_quote_id: quoteId,
    p_items: items.map(i => ({
      inventory_item_id: i.inventory_item_id,
      room: i.room,
      quantity: i.quantity,
      item_name: i.item_name,
      volume: i.volume,
    })),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function generateQuotePublicToken(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string
) {
  const { data: quote, error: fetchError } = await supabase
    .from('quotes')
    .select('public_token')
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .single()

  if (fetchError) {
    return { success: false, error: fetchError.message }
  }

  if (quote.public_token) {
    return { success: true, token: quote.public_token }
  }

  const { data: tokenResult, error: rpcError } = await supabase.rpc(
    'generate_proposal_token'
  )

  if (rpcError) {
    return { success: false, error: rpcError.message }
  }

  const token = tokenResult as string

  const { error: updateError } = await supabase
    .from('quotes')
    .update({ public_token: token })
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  return { success: true, token }
}

export async function getQuoteByPublicToken(
  supabase: SupabaseClient<Database>,
  token: string
) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(
      `
      *,
      contact:contacts!quotes_contact_fk(id, first_name, last_name, email, phone),
      tenant:tenants!quotes_tenant_fk(id)
    `
    )
    .eq('public_token', token)
    .eq('status', 'sent')
    .single()

  console.error('[getQuoteByPublicToken] DEBUG:', {
    token,
    quoteFound: !!quote,
    quoteId: quote?.id,
    errorMessage: error?.message,
    errorCode: error?.code,
    errorStatus: error?.status,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, quote }
}
export async function saveQuoteSignature(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
  signatureName: string,
  base64Image: string,
  documentHash: string,
  ipAddress: string | null
) {
  // Convert base64 to buffer
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  
  const timestamp = new Date().getTime()
  const storagePath = `${tenantId}/signature_${timestamp}.png`
  
  // 1. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('signatures')
    .upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    })
    
  if (uploadError) {
    return { success: false, error: 'Failed to upload signature image: ' + uploadError.message }
  }
  
  // 2. Insert into quote_signatures
  const { error: dbError } = await supabase
    .from('quote_signatures')
    .insert({
      tenant_id: tenantId,
      quote_id: quoteId,
      signature_name: signatureName,
      signature_storage_path: storagePath,
      document_hash: documentHash,
      ip_address: ipAddress,
    })
    
  if (dbError) {
    return { success: false, error: 'Failed to save signature record: ' + dbError.message }
  }
  
  return { success: true }
}

import { createJobFromQuoteTransaction } from '@/modules/jobs/server/repository'
import { computeInvoicePlan } from '@/modules/invoicing/server/plan'

export async function markQuoteAccepted(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  quoteId: string,
  stripePaymentIntentId?: string
) {
  // 1. Fetch the quote and its associated lead to gather job data
  const { data: quoteData, error: quoteError } = await supabase
    .from('quotes')
    .select('id, contact_id, lead_id, status, subtotal, surcharge_total, total_price, deposit_amount')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .single()

  if (quoteError || !quoteData) {
    return { success: false, error: 'Quote not found', alreadyAccepted: false }
  }

  // No pre-check here — the RPC guard is the single idempotency point
  // If the quote is already accepted, the RPC will detect it and return P0002
  let moveDate = null
  let originAddressId = null
  let destAddressId = null

  if (quoteData.lead_id) {
    const { data: leadData } = await supabase
      .from('leads')
      .select('preferred_move_date, origin_address_id, destination_address_id')
      .eq('id', quoteData.lead_id)
      .eq('tenant_id', tenantId)
      .single()

    if (leadData) {
      moveDate = leadData.preferred_move_date
      originAddressId = leadData.origin_address_id
      destAddressId = leadData.destination_address_id
    }
  }

  // 2. Fetch tenant settings to get balance due offset
  const { data: tenantSettings } = await supabase
    .from('tenant_settings')
    .select('balance_due_days_before_move')
    .eq('tenant_id', tenantId)
    .single()

  const balanceDueDaysBeforeMove = tenantSettings?.balance_due_days_before_move ?? 2

  // 3. Compute the invoice plan in TypeScript (explicit, testable step)
  const invoicePlan = computeInvoicePlan(
    {
      subtotal: Number(quoteData.subtotal) || 0,
      surcharge_total: Number(quoteData.surcharge_total) || 0,
      total_price: Number(quoteData.total_price) || 0,
      deposit_amount: Number(quoteData.deposit_amount) || 0,
    },
    moveDate || new Date().toISOString().split('T')[0],
    balanceDueDaysBeforeMove
  )

  // 4. Delegate to the jobs module to execute the transaction
  // This wraps Quote Update, Job Creation, Lead Update, Event Emission, and Invoice Generation in one ACID step
  const result = await createJobFromQuoteTransaction(supabase, tenantId, {
    quote_id: quoteId,
    contact_id: quoteData.contact_id,
    lead_id: quoteData.lead_id,
    move_date: moveDate,
    origin_address_id: originAddressId,
    destination_address_id: destAddressId,
    stripe_payment_intent_id: stripePaymentIntentId,
    invoicePlan,
  })

  return result
}
