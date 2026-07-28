import { z } from 'zod'

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  job_id: z.string().uuid().nullable(),
  contact_id: z.string().uuid(),
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

// Composite type for UI to easily display an invoice with its line items and schedules
export type InvoiceWithDetails = Invoice & {
  lineItems: InvoiceLineItem[]
  schedules: PaymentSchedule[]
  payments: Payment[]
}
