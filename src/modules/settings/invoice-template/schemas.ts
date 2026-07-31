import { z } from 'zod'

// Every block's config is a closed, named shape with no field capable of
// holding an amount/quantity/total — real financial figures are always
// fetched live from invoices/invoice_line_items at render time (the next
// branch's job), never embedded here. This is the structural guarantee that
// a layout can't drift into a second copy of financial data.

// .strict() on every config shape is deliberate: an unrecognized key (e.g.
// someone mistakenly trying to add `amount`) must be a loud validation
// error, never silently stripped — zod objects strip unknown keys by
// default, which would quietly mask exactly the mistake this schema exists
// to prevent.

const headerBlockSchema = z.object({
  type: z.literal('header'),
  config: z
    .object({
      showLogo: z.boolean().default(true),
      alignment: z.enum(['left', 'center', 'right']).default('left'),
    })
    .strict(),
})

const lineItemsTableBlockSchema = z.object({
  type: z.literal('line_items_table'),
  config: z
    .object({
      columns: z
        .array(z.enum(['description', 'quantity', 'unit_price', 'amount']))
        .default(['description', 'quantity', 'unit_price', 'amount']),
    })
    .strict(),
})

const totalsSummaryBlockSchema = z.object({
  type: z.literal('totals_summary'),
  config: z
    .object({
      showTaxBreakdown: z.boolean().default(true),
    })
    .strict(),
})

// Text itself comes from tenant_settings.terms_template at render time —
// deliberately no override-text field here, so this can't drift into a
// second copy of terms language either.
const termsTextBlockSchema = z.object({
  type: z.literal('terms_text'),
  config: z
    .object({
      show: z.boolean().default(true),
    })
    .strict(),
})

const footerBlockSchema = z.object({
  type: z.literal('footer'),
  config: z
    .object({
      showPageNumber: z.boolean().default(true),
      customText: z.string().nullable().default(null),
    })
    .strict(),
})

const spacerBlockSchema = z.object({
  type: z.literal('spacer'),
  config: z
    .object({
      heightPx: z.number().int().positive().default(16),
    })
    .strict(),
})

export const invoiceLayoutBlockSchema = z.discriminatedUnion('type', [
  headerBlockSchema,
  lineItemsTableBlockSchema,
  totalsSummaryBlockSchema,
  termsTextBlockSchema,
  footerBlockSchema,
  spacerBlockSchema,
])

export type InvoiceLayoutBlock = z.infer<typeof invoiceLayoutBlockSchema>

export const invoiceTemplateSchema = z.object({
  layout_blocks: z.array(invoiceLayoutBlockSchema),
})

export type InvoiceTemplateInput = z.infer<typeof invoiceTemplateSchema>
