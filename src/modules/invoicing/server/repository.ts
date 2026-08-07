import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InvoiceWithDetails, UpdateDraftInvoiceInput } from '../schema'

export async function getInvoicesByJob(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  jobId: string
): Promise<{ success: boolean; data?: InvoiceWithDetails[]; error?: string }> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_line_items (*),
      payment_schedules (*),
      payments (*)
    `)
    .eq('tenant_id', tenantId)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  // The types returned from Supabase via `*` joins are slightly loose, 
  // but they structurally match the InvoiceWithDetails because we select all columns.
  const invoices = (data || []).map(row => ({
    ...row,
    lineItems: row.invoice_line_items || [],
    schedules: row.payment_schedules || [],
    payments: row.payments || []
  })) as unknown as InvoiceWithDetails[]

  return { success: true, data: invoices }
}

export async function getInvoicesByContact(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  contactId: string
): Promise<{ success: boolean; data?: InvoiceWithDetails[]; error?: string }> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_line_items (*),
      payment_schedules (*),
      payments (*)
    `)
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const invoices = (data || []).map(row => ({
    ...row,
    lineItems: row.invoice_line_items || [],
    schedules: row.payment_schedules || [],
    payments: row.payments || []
  })) as unknown as InvoiceWithDetails[]

  return { success: true, data: invoices }
}

export async function getInvoiceById(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string
): Promise<{ success: boolean; data?: InvoiceWithDetails; error?: string }> {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      *,
      invoice_line_items (*),
      payment_schedules (*),
      payments (*)
    `)
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: false, error: 'Invoice not found' }
  }

  const invoice = {
    ...data,
    lineItems: data.invoice_line_items || [],
    schedules: data.payment_schedules || [],
    payments: data.payments || []
  } as unknown as InvoiceWithDetails

  return { success: true, data: invoice }
}

export async function updatePaymentScheduleStatus(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  scheduleId: string,
  status: 'pending' | 'paid' | 'overdue'
) {
  const { error } = await supabase
    .from('payment_schedules')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', scheduleId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function recordInvoicePayment(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string,
  scheduleId: string,
  stripeIntentId: string,
  amount: number
) {
  const { data, error } = await supabase.rpc('record_invoice_payment', {
    p_tenant_id: tenantId,
    p_invoice_id: invoiceId,
    p_schedule_id: scheduleId,
    p_stripe_intent_id: stripeIntentId,
    p_amount: amount
  })

  if (error) {
    return { success: false, error: 'Failed to record payment: ' + error.message }
  }

  return { success: true, alreadyPaid: (data as any)?.already_paid }
}

export async function updateDraftInvoice(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string,
  input: UpdateDraftInvoiceInput
): Promise<{ success: boolean; error?: string; reason?: 'not_found' | 'not_draft' | 'has_payments' | 'tenant_mismatch' }> {
  const { data, error } = await (supabase as any).rpc('update_draft_invoice', {
    p_tenant_id: tenantId,
    p_invoice_id: invoiceId,
    p_notes: input.notes ?? null,
    p_line_items: input.lineItems,
  })

  if (error) {
    // Distinct error codes raised inside the RPC's own transaction —
    // this is the guard that actually matters, not the Server Action's
    // own pre-check (which can only ever be advisory/fast-fail).
    if (error.code === 'P0012') {
      return { success: false, error: 'Tenant mismatch', reason: 'tenant_mismatch' }
    }
    if (error.code === 'P0002') {
      return { success: false, error: 'Invoice not found', reason: 'not_found' }
    }
    if (error.code === 'P0010') {
      return { success: false, error: 'This invoice is no longer a draft and can no longer be edited.', reason: 'not_draft' }
    }
    if (error.code === 'P0011') {
      return { success: false, error: 'This invoice already has a payment recorded against it and can no longer be edited.', reason: 'has_payments' }
    }
    return { success: false, error: error.message }
  }

  return { success: true, ...(data as any) }
}

export async function getOutstandingInvoices(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  limit: number = 5
) {
  const { data, error } = await supabase
    .from('invoices')
    .select(`
      id,
      total,
      status,
      due_date,
      job:jobs(id, contact:contacts(first_name, last_name))
    `)
    .eq('tenant_id', tenantId)
    .not('status', 'eq', 'paid')
    .not('status', 'eq', 'void')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(limit)

  return { success: !error, invoices: data || [], error: error?.message }
}

