import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { CreateJobFromQuoteData, JobSchema, Job, UpdateJobDetailsInput } from '../schema'
import { format, addDays } from 'date-fns'

export async function createJobFromQuoteTransaction(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  data: CreateJobFromQuoteData
) {
  // Call the transactional RPC.
  // We use this to wrap Quote update, Job insert, Lead update, and Event insert
  // into one ACID-compliant database transaction since the REST API lacks BEGIN/COMMIT.
  // Invoice plan is pre-computed in TypeScript, not derived in SQL.
  const { data: result, error } = await supabase.rpc('accept_quote_transaction', {
    p_tenant_id: tenantId,
    p_quote_id: data.quote_id,
    p_lead_id: data.lead_id || null,
    p_contact_id: data.contact_id,
    p_move_date: data.move_date || null,
    p_origin_address_id: data.origin_address_id || null,
    p_destination_address_id: data.destination_address_id || null,
    p_stripe_payment_intent_id: data.stripe_payment_intent_id || null,
    p_invoice_subtotal: data.invoicePlan.subtotal,
    p_invoice_tax_amount: data.invoicePlan.taxAmount,
    p_invoice_total: data.invoicePlan.total,
    p_line_items: data.invoicePlan.lineItems as any,
    p_deposit_schedule: data.invoicePlan.depositSchedule as any,
    p_balance_schedule: data.invoicePlan.balanceSchedule as any,
  })

  if (error) {
    // Detect idempotent retry: quote was already accepted (status no longer 'sent')
    if (error.code === 'P0002') {
      return { success: false, alreadyAccepted: true, error: error.message }
    }
    return { success: false, alreadyAccepted: false, error: 'Transaction failed: ' + error.message }
  }

  return { success: true, jobId: (result as any)?.job_id }
}

export async function getJobById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string
) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  const parsed = JobSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Data validation failed' }
  }

  return { success: true, job: parsed.data }
}

export async function getJobsByTenant(
  supabase: SupabaseClient<Database>,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      contact:contacts(first_name, last_name, email, phone)
    `)
    .eq('tenant_id', tenantId)
    .order('move_date', { ascending: true })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, jobs: data }
}

export interface ConfirmedBookingItem {
  id: string
  status: string
  move_date: string | null
  customer_notes: string | null
  internal_notes: string | null
  created_at: string
  updated_at: string | null
  contact: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    company_name: string | null
  } | null
  origin_address: {
    line_1: string | null
    city: string | null
    postcode: string | null
  } | null
  destination_address: {
    line_1: string | null
    city: string | null
    postcode: string | null
  } | null
  quote: {
    id: string
    total_price: number
    lead_id: string | null
    lead: {
      id: string
      stage: string
      source: string | null
    } | null
  } | null
}

export async function getConfirmedBookingsByTenant(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options?: {
    statusFilter?: string
    timeframe?: 'upcoming' | 'past' | 'all'
    search?: string
  }
) {
  let query = supabase
    .from('jobs')
    .select(`
      id,
      status,
      move_date,
      customer_notes,
      internal_notes,
      created_at,
      updated_at,
      contact:contacts(id, first_name, last_name, email, phone, company_name),
      origin_address:addresses!jobs_origin_address_fk(line_1, city, postcode),
      destination_address:addresses!jobs_destination_address_fk(line_1, city, postcode),
      quote:quotes(
        id,
        total_price,
        lead_id,
        lead:leads(id, stage, source)
      )
    `)
    .eq('tenant_id', tenantId)

  // Filter by status if specified (defaults to non-cancelled)
  if (options?.statusFilter && options.statusFilter !== 'all') {
    query = query.eq('status', options.statusFilter as any)
  } else {
    query = query.neq('status', 'cancelled')
  }

  const todayStr = new Date().toISOString().split('T')[0]
  if (options?.timeframe === 'upcoming') {
    query = query.or(`move_date.gte.${todayStr},move_date.is.null`)
  } else if (options?.timeframe === 'past') {
    query = query.lt('move_date', todayStr)
  }

  query = query.order('move_date', { ascending: true, nullsFirst: false })

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message, bookings: [] }
  }

  return { success: true, bookings: (data as unknown as ConfirmedBookingItem[]) ?? [] }
}

export async function getUnlinkedConfirmedLeads(
  supabase: SupabaseClient<Database>,
  tenantId: string
) {
  // Query leads at stage = 'confirmed_booking'
  const { data: leads, error } = await supabase
    .from('leads')
    .select(`
      id,
      stage,
      preferred_move_date,
      created_at,
      contact:contacts(first_name, last_name, email, phone)
    `)
    .eq('tenant_id', tenantId)
    .eq('stage', 'confirmed_booking')
    .eq('is_archived', false)

  if (error || !leads) {
    return { success: true, count: 0, leads: [] }
  }

  // Check which leads don't have a linked job via quotes
  const { data: jobsWithQuotes } = await supabase
    .from('jobs')
    .select('quote:quotes(lead_id)')
    .eq('tenant_id', tenantId)

  const linkedLeadIds = new Set(
    (jobsWithQuotes ?? [])
      .map((j) => (j.quote as any)?.lead_id)
      .filter(Boolean)
  )

  const unlinked = leads.filter((l) => !linkedLeadIds.has(l.id))

  return { success: true, count: unlinked.length, leads: unlinked }
}

export async function getJobDetails(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string
) {
  // Use a transaction/RPC or just joined query. 
  // We want the Job, Contact, Addresses, Quote, and Quote Inventory snapshot
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      contact:contacts(first_name, last_name, email, phone, company_name),
      origin_address:addresses!jobs_origin_address_fk(*),
      destination_address:addresses!jobs_destination_address_fk(*),
      job_photos(*),
      quote:quotes(
        id, subtotal, surcharge_total, total_price, deposit_amount, status, total_volume, terms,
        lead:leads(source),
        quote_inventory(
          id,
          quantity,
          inventory_item:inventory_items(id, name, room, default_volume)
        )
      )
    `)
    .eq('id', jobId)
    .eq('tenant_id', tenantId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return { success: false, error: 'Job not found' }
    }
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: false, error: 'Job not found' }
  }

  return { success: true, jobDetails: data }
}

export async function updateJob(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string,
  updates: UpdateJobDetailsInput
) {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', jobId)
    .eq('tenant_id', tenantId) // Explicit tenant scoping — never trust jobId alone
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }
  if (!data) {
    return { success: false, error: 'Job not found' }
  }

  return { success: true, job: data }
}

export interface UpcomingJobItem {
  id: string
  status: Database['public']['Enums']['job_status']
  move_date: string | null
  customer_notes?: string | null
  contact: {
    first_name: string | null
    last_name: string | null
    phone?: string | null
    email?: string | null
  } | null
  origin_address?: {
    line_1: string | null
    city: string | null
    postcode: string | null
  } | null
  destination_address?: {
    line_1: string | null
    city: string | null
    postcode: string | null
  } | null
  quote?: {
    total_price: number | null
  } | null
}

export async function getUpcomingJobs(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  options?: { days?: number; limit?: number } | number
): Promise<{ success: boolean; jobs?: UpcomingJobItem[]; error?: string }> {
  const days = typeof options === 'number' ? undefined : (options?.days ?? 7)
  const limit = typeof options === 'number' ? options : options?.limit

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const maxDateStr = format(addDays(new Date(), days ?? 7), 'yyyy-MM-dd')

  let query = supabase
    .from('jobs')
    .select(`
      id,
      status,
      move_date,
      customer_notes,
      contact:contacts(first_name, last_name, phone, email),
      origin_address:addresses!jobs_origin_address_fk(line_1, city, postcode),
      destination_address:addresses!jobs_destination_address_fk(line_1, city, postcode),
      quote:quotes(total_price)
    `)
    .eq('tenant_id', tenantId)
    .gte('move_date', todayStr)
    .lte('move_date', maxDateStr)
    .in('status', ['scheduled', 'in_progress'])
    .order('move_date', { ascending: true })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, jobs: (data as any) || [] }
}

