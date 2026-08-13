import { z } from 'zod'

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  job_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid(),
  brand_id: z.string().uuid(),
  brand_snapshot: z.unknown(),
  invoice_number: z.string().nullable(),
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void']),
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0),
  total: z.number().min(0),
  issued_at: z.string().nullable(),
  due_date: z.string().nullable(),
  paid_at: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
})

export type Invoice = z.infer<typeof invoiceSchema>

export const invoiceLineItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  amount: z.number(),
  sort_order: z.number(),
  created_at: z.string(),
})

export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>

export const paymentScheduleSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  description: z.string(),
  amount: z.number(),
  due_date: z.string(),
  status: z.enum(['pending', 'paid', 'overdue']),
  created_at: z.string(),
  updated_at: z.string().nullable(),
})

export type PaymentSchedule = z.infer<typeof paymentScheduleSchema>

export const paymentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  payment_schedule_id: z.string().uuid().nullable(),
  amount: z.number(),
  method: z.enum(['card', 'apple_pay', 'google_pay', 'bank_transfer']),
  stripe_payment_intent_id: z.string().nullable(),
  status: z.enum(['pending', 'succeeded', 'failed', 'refunded']),
  paid_at: z.string().nullable(),
  created_at: z.string(),
})

export type Payment = z.infer<typeof paymentSchema>

// Real, structured location data this app actually tracks for a job — no
// time-of-day field exists anywhere in the schema, so none is invented here.
export type InvoiceAddressInfo = {
  line_1: string
  line_2: string | null
  city: string
  county: string | null
  postcode: string
  country: string
} | null

export type InvoiceJobInfo = {
  status: string
  move_date: string | null
  customer_notes: string | null
  origin_address: InvoiceAddressInfo
  destination_address: InvoiceAddressInfo
} | null

// Composite type for UI to easily display an invoice with its line items and schedules
export type InvoiceWithDetails = Invoice & {
  lineItems: InvoiceLineItem[]
  schedules: PaymentSchedule[]
  payments: Payment[]
  job: InvoiceJobInfo
}

// ============================================================================
// DRAFT INVOICE EDITING
// ============================================================================
// amount is deliberately absent — it's always quantity * unit_price,
// recomputed server-side inside update_draft_invoice, never accepted from
// the client. subtotal/total are similarly never part of this input; they're
// always derived from the sum of these line items.
export const editInvoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be greater than 0'),
  unit_price: z.number().min(0, 'Unit price cannot be negative'),
  sort_order: z.number().int(),
})

export const updateDraftInvoiceSchema = z.object({
  notes: z.string().optional().nullable(),
  lineItems: z.array(editInvoiceLineItemSchema).min(1, 'At least one line item is required'),
})

export type EditInvoiceLineItemInput = z.infer<typeof editInvoiceLineItemSchema>
export type UpdateDraftInvoiceInput = z.infer<typeof updateDraftInvoiceSchema>
