import { z } from 'zod'

// Every block's config is a closed, named shape with no field capable of
// holding an amount/quantity/total — real financial figures are always
// fetched live from invoices/invoice_line_items at render time (the next
// branch's job), never embedded here. This is the structural guarantee that
// a layout can't drift into a second copy of financial data.
//
// The exact enforcement mechanism, stated plainly: `.strict()` prevents an
// UNRECOGNIZED key from ever being silently accepted (a loud validation
// error instead), which stops someone bolting an extra field onto an
// existing block's config. It does NOT, by itself, stop a genuinely new
// field from being semantically financial — that's enforced by design
// convention (every field added below is a boolean/enum/short label
// string, reviewed for exactly this), not a runtime type check. The one
// place this matters most — Custom Field (below) — closes that gap
// properly: its config can only ever hold a `fieldKey` drawn from a fixed
// z.enum(...) allow-list, never a free-typed value of any kind, so it's
// impossible to smuggle a number through it even via a direct action call,
// not just hidden in the UI.

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
      // Previously always-shown whenever the brand had the data — now
      // individually toggleable, same reasoning as Location/Additional
      // Details below (e.g. a non-VAT-registered brand may want the VAT
      // line hidden entirely, not just blank).
      showAddress: z.boolean().default(true),
      showVatNumber: z.boolean().default(true),
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
// time field. Four real, independent fields — each individually
// toggleable, not one `show` bundling all four (the previous shape).
const locationDetailsBlockSchema = z.object({
  type: z.literal('location_details'),
  config: z
    .object({
      showMoveDate: z.boolean().default(true),
      showOrigin: z.boolean().default(true),
      showDestination: z.boolean().default(true),
      showNotes: z.boolean().default(true),
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
// real status at render time, never a config field. Three real,
// independent rows — each individually toggleable (previously
// showJobStatus was the only togglable one; advance/balance were always
// on with no control at all).
const additionalDetailsBlockSchema = z.object({
  type: z.literal('additional_details'),
  config: z
    .object({
      showAdvanceReceived: z.boolean().default(true),
      showJobStatus: z.boolean().default(true),
      showBalanceOutstanding: z.boolean().default(true),
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

// Purely tenant-authored static content — same shape/safety as
// terms_text/footer.customText: free text, never a number, never fetched
// from anywhere. A label + a body, both plain strings.
const customTextBlockSchema = z.object({
  type: z.literal('custom_text'),
  config: z
    .object({
      label: z.string().default(''),
      text: z.string().default(''),
    })
    .strict(),
})

// The allow-list itself — every entry is a real, existing, non-financial
// field already available in the invoice render pipeline (invoice/job/
// contact — no new joins required). This is the ONLY place a Custom Field
// block's value can come from: config holds a `fieldKey` from this enum,
// never a free-typed value, so there is no way — UI or direct action call
// — to make this block hold an invented or financial figure. Two real
// fields considered and deliberately left out: crew member names and
// assigned vehicle — both would require a new join (job_crew_assignments/
// job_vehicle_assignments -> users/vehicles) not currently in
// getInvoiceById's query; scoping that out of this pass rather than
// silently working around it.
export const CUSTOM_FIELD_KEYS = [
  'invoice_number',
  'invoice_status',
  'issued_date',
  'due_date',
  'move_date',
  'job_status',
  'customer_name',
  'customer_email',
  'customer_phone',
  'customer_company',
  'origin_address',
  'destination_address',
  'job_notes',
] as const

export const customFieldKeyEnum = z.enum(CUSTOM_FIELD_KEYS)
export type CustomFieldKey = z.infer<typeof customFieldKeyEnum>

const customFieldBlockSchema = z.object({
  type: z.literal('custom_field'),
  config: z
    .object({
      label: z.string().default(''),
      fieldKey: customFieldKeyEnum,
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
  customTextBlockSchema,
  customFieldBlockSchema,
])

export type InvoiceLayoutBlock = z.infer<typeof invoiceLayoutBlockSchema>

export const invoiceTemplateSchema = z.object({
  layout_blocks: z.array(invoiceLayoutBlockSchema),
})

export type InvoiceTemplateInput = z.infer<typeof invoiceTemplateSchema>
