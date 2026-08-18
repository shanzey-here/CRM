'use server'

import { createClient } from '@/lib/supabase/server'
import { updateDraftInvoice, getInvoiceById } from '@/modules/invoicing/server/repository'
import { updateDraftInvoiceSchema, UpdateDraftInvoiceInput } from '@/modules/invoicing/schema'
import { revalidatePath } from 'next/cache'

// Editing an invoice's real line items/figures is a financial-figure change
// to what a customer is being billed — the same weight class as corporate
// pricing overrides, not routine operational note-taking (Lead/Job notes
// are dispatcher-editable; this is deliberately tenant_admin-only).
export async function updateDraftInvoiceAction(invoiceId: string, payload: UpdateDraftInvoiceInput) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { success: false, error: 'No tenant context' }
  }

  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  if (role !== 'tenant_admin') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // 2. Validate payload — never trust client shape
  const parseResult = updateDraftInvoiceSchema.safeParse(payload)
  if (!parseResult.success) {
    return { success: false, error: 'Validation failed', issues: parseResult.error.flatten() }
  }

  // 3. Fast-fail check — advisory only. This does NOT make the write safe;
  // it just avoids a wasted RPC round-trip for the common "someone left
  // this page open" case. The real, unbypassable guarantee is entirely
  // inside update_draft_invoice's own FOR UPDATE + re-check.
  const existing = await getInvoiceById(supabase, tenantId, invoiceId)
  if (!existing.success || !existing.data) {
    return { success: false, error: 'Invoice not found' }
  }
  if (existing.data.status !== 'draft') {
    return { success: false, error: 'This invoice is no longer a draft and can no longer be edited.' }
  }
  if (existing.data.payments.length > 0) {
    return { success: false, error: 'This invoice already has a payment recorded against it and can no longer be edited.' }
  }

  // 4. The real guard — atomic, inside the RPC's own transaction.
  const result = await updateDraftInvoice(supabase, tenantId, invoiceId, parseResult.data)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to update invoice' }
  }

  // 5. Revalidate
  revalidatePath(`/office/invoices/${invoiceId}`)

  return { success: true }
}
