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

// 'medium' matches the fixed size every template used before this field
// existed (h-12 / 48px) — existing saved templates have no logoSize key at
// all, so both the zod default here (new saves) and the renderer's runtime
// fallback (old saved JSON, never re-validated through this schema) must
// independently resolve missing to 'medium', or an old template's logo
// would silently shift size the first time it's viewed after this change.
const logoSizeEnum = z.enum(['small', 'medium', 'large'])

const headerBlockSchema = z.object({
  type: z.literal('header'),
  config: z
    .object({
      showLogo: z.boolean().default(true),
      alignment: z.enum(['left', 'center', 'right']).default('left'),
      logoSize: logoSizeEnum.default('medium'),
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

// Job date/address/move-notes — sourced live from the invoice's job at
// render time (never embedded here), same rule as every other block. A job
// has no time-of-day field anywhere in this app's real schema, so only what
// this app actually tracks (date, address, notes) is shown — no invented
// time field.
const locationDetailsBlockSchema = z.object({
  type: z.literal('location_details'),
  config: z
    .object({
      show: z.boolean().default(true),
    })
    .strict(),
})

// Bank/payment instructions — text comes from the brand's bank_details at
// render time (live brand row for preview, frozen brand_snapshot for an
// issued invoice), same pattern terms_text already established for
// tenant/brand-owned text.
const paymentInstructionsBlockSchema = z.object({
  type: z.literal('payment_instructions'),
  config: z
    .object({
      show: z.boolean().default(true),
    })
    .strict(),
})

// Advance received / balance outstanding / job status — every figure here
// is computed live from the invoice's real payments/total and its job's
// real status at render time, never a config field.
const additionalDetailsBlockSchema = z.object({
  type: z.literal('additional_details'),
  config: z
    .object({
      showJobStatus: z.boolean().default(true),
    })
    .strict(),
})

// The invoice total spelled out in words — derived live from invoice.total,
// never a stored figure.
const totalInWordsBlockSchema = z.object({
  type: z.literal('total_in_words'),
  config: z
    .object({
      show: z.boolean().default(true),
    })
    .strict(),
})

// Declaration text is genuinely configurable copy (like footer.customText),
// not financial data — the signature line itself is always blank/unsigned
// on a rendered document, never pre-filled.
const declarationSignatureBlockSchema = z.object({
  type: z.literal('declaration_signature'),
  config: z
    .object({
      declarationText: z.string().default('I have read & understood all the above terms.'),
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
  locationDetailsBlockSchema,
  paymentInstructionsBlockSchema,
  additionalDetailsBlockSchema,
  totalInWordsBlockSchema,
  declarationSignatureBlockSchema,
])

export type InvoiceLayoutBlock = z.infer<typeof invoiceLayoutBlockSchema>

export const invoiceTemplateSchema = z.object({
  layout_blocks: z.array(invoiceLayoutBlockSchema),
})

export type InvoiceTemplateInput = z.infer<typeof invoiceTemplateSchema>
