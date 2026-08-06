import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { CreateJobFromQuoteData, JobSchema, Job } from '../schema'

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

export async function getUpcomingJobs(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  limit: number = 5
) {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id,
      status,
      move_date,
      contact:contacts(first_name, last_name)
    `)
    .eq('tenant_id', tenantId)
    .gte('move_date', new Date().toISOString().split('T')[0])
    .not('status', 'eq', 'completed')
    .not('status', 'eq', 'cancelled')
    .order('move_date', { ascending: true })
    .limit(limit)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, jobs: data }
}

