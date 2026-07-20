import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InvoiceWithDetails } from '../schema'

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
