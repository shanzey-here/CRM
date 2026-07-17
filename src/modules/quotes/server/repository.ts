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
