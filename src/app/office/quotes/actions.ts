'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertQuoteSchema, saveQuoteInventorySchema } from '@/modules/quotes/schemas'
import {
  createQuote as repoCreateQuote,
  saveQuoteInventory as repoSaveQuoteInventory,
  generateQuotePublicToken,
  markQuoteSent,
} from '@/modules/quotes/server/repository'

export async function createQuoteAction(payload: unknown) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id

  const parsed = insertQuoteSchema.safeParse(payload)
  if (!parsed.success) {
    // Same shape saveQuoteInventoryAction already returns — real
    // field-level detail, not a bare string, so the caller can show
    // exactly what failed instead of a generic message.
    return { success: false, error: 'Validation failed', details: parsed.error.issues }
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

export async function generateProposalLinkAction(quoteId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id as string

  const result = await markQuoteSent(supabase, tenantId, quoteId)
  if (!result.success || !result.token) {
    return { success: false, error: result.error }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const proposalUrl = `${baseUrl}/proposal/${result.token}`

  return { success: true, token: result.token, url: proposalUrl }
}

export async function sendQuoteAction(input: {
  quoteId: string
  leadId: string
  sendEmail?: boolean
  customEmailMessage?: string
}): Promise<{
  success: boolean
  token?: string
  url?: string
  emailSent?: boolean
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id as string

  // 1. Mark quote as sent and ensure public token exists
  const quoteResult = await markQuoteSent(supabase, tenantId, input.quoteId)
  if (!quoteResult.success || !quoteResult.token) {
    return { success: false, error: quoteResult.error || 'Failed to prepare quote proposal' }
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const proposalUrl = `${baseUrl}/proposal/${quoteResult.token}`

  let emailSent = false
  // 2. If sendEmail is requested, compose and send proposal email via connected mailbox
  if (input.sendEmail) {
    try {
      const { data: quote } = await supabase
        .from('quotes')
        .select(`
          id, total_price, computed_price, brand_id,
          contact:contacts!quotes_contact_fk(id, first_name, last_name, email),
          brand:brands(id, name)
        `)
        .eq('id', input.quoteId)
        .eq('tenant_id', tenantId)
        .single()

      const contact = quote?.contact as any
      const brand = quote?.brand as any
      if (contact?.email) {
        const { data: mailbox } = await supabase
          .from('mailboxes')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'connected')
          .limit(1)
          .maybeSingle()

        if (mailbox && mailbox.mailbox_address) {
          const { buildOutboundMessage, sendMessage } = await import('@/modules/mailboxes/server/send')
          const { createServiceRoleClient } = await import('@/lib/supabase/service-role')
          const serviceClient = createServiceRoleClient()

          const price = quote?.computed_price || quote?.total_price || 0
          const companyName = brand?.name || 'Gomove Removals'
          const customerName = contact.first_name || 'Valued Customer'
          const body = input.customEmailMessage || 
            `Dear ${customerName},\n\nThank you for choosing ${companyName}. We have prepared your moving quote: £${Number(price).toFixed(2)}.\n\nPlease review and accept your detailed proposal online at:\n${proposalUrl}\n\nKind regards,\n${companyName}`

          const { raw } = buildOutboundMessage({
            from: mailbox.mailbox_address,
            to: contact.email,
            subject: `Your Moving Proposal from ${companyName}`,
            bodyText: body,
          })

          const sendRes = await sendMessage(serviceClient, mailbox as any, raw, null, contact.email)
          if (sendRes.ok) {
            emailSent = true
          }
        }
      }
    } catch (emailErr) {
      console.error('[sendQuoteAction] Email dispatch warning:', emailErr)
    }
  }

  // 3. Auto-transition lead stage to 'quote_sent' via canonical shared transition function
  const { updateLeadStage } = await import('@/app/office/leads/actions')
  const stageResult = await updateLeadStage(input.leadId, 'quote_sent')

  revalidatePath('/office/leads')
  revalidatePath(`/office/leads/${input.leadId}`)
  revalidatePath(`/office/quotes/${input.quoteId}`)

  if (!stageResult.success) {
    return {
      success: true,
      token: quoteResult.token,
      url: proposalUrl,
      emailSent,
      error: `Quote marked as sent, but stage transition failed: ${stageResult.error}`,
    }
  }

  return {
    success: true,
    token: quoteResult.token,
    url: proposalUrl,
    emailSent,
  }
}

export async function getQuotesForLeadAction(leadId: string): Promise<{
  success: boolean
  quotes?: {
    id: string
    status: string
    total_volume: number | null
    total_price: number
    computed_price: number | null
    public_token: string | null
    created_at: string
    updated_at: string | null
  }[]
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata.tenant_id as string
  const { data, error } = await supabase
    .from('quotes')
    .select('id, status, total_volume, total_price, computed_price, public_token, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, quotes: data || [] }
}
