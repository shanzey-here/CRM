import { InvoiceWithDetails, InvoiceAddressInfo } from '@/modules/invoicing/schema'
import { Contact } from '@/modules/clients/server/repository'
import { InvoiceLayoutBlock } from '@/modules/settings/invoice-template/schemas'
import { BrandIdentity } from '@/modules/settings/brands/schemas'
import { amountToWords } from './number-to-words'

interface InvoiceRendererProps {
  blocks: InvoiceLayoutBlock[]
  invoice: InvoiceWithDetails
  // A live `brands` row (template editor preview — nothing frozen yet) or a
  // frozen `invoices.brand_snapshot` (a real, already-issued invoice). Both
  // conform to BrandIdentity's exact key set, so this renderer never needs
  // to know or care which one it was handed.
  brand: BrandIdentity
  contact: Contact
}

function formatCurrency(amount: number) {
  return `£${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAddress(addr: InvoiceAddressInfo) {
  if (!addr) return null
  return [addr.line_1, addr.line_2, addr.city, addr.county, addr.postcode].filter(Boolean).join(', ')
}

const COLUMN_LABELS: Record<string, string> = {
  description: 'Description',
  quantity: 'Qty',
  unit_price: 'Unit Price',
  amount: 'Amount',
}

// Real Tailwind height classes, not arbitrary — 'medium' (h-12/48px)
// matches the fixed size every template used before logoSize existed.
const LOGO_SIZE_CLASSES: Record<string, string> = {
  small: 'h-8',
  medium: 'h-12',
  large: 'h-16',
}

const JOB_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Delivered',
  cancelled: 'Cancelled',
}

// Pure presentational component — no data fetching of any kind. Every
// figure it renders comes from the invoice/brand/contact objects it's
// handed; it never reads a number out of a block's own config, because no
// block's .strict() config shape has a field capable of holding one.
export function InvoiceRenderer({ blocks, invoice, brand, contact }: InvoiceRendererProps) {
  return (
    <div className="bg-white text-slate-900 text-sm">
      {blocks.map((block, index) => (
        <InvoiceBlock key={index} block={block} invoice={invoice} brand={brand} contact={contact} />
      ))}
    </div>
  )
}

function InvoiceBlock({
  block,
  invoice,
  brand,
  contact,
}: {
  block: InvoiceLayoutBlock
  invoice: InvoiceWithDetails
  brand: BrandIdentity
  contact: Contact
}) {
  switch (block.type) {
    case 'header':
      return (
        <div
          className="flex items-start gap-4 py-4 border-b border-slate-200"
          style={{
            justifyContent: block.config.alignment === 'center' ? 'center' : block.config.alignment === 'right' ? 'flex-end' : 'flex-start',
            textAlign: block.config.alignment,
          }}
        >
          {block.config.showLogo && brand.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logo_url}
              alt=""
              className={`${LOGO_SIZE_CLASSES[block.config.logoSize] || LOGO_SIZE_CLASSES.medium} w-auto object-contain`}
            />
          )}
          <div>
            <p className="font-bold text-lg">{brand.name || 'Your Company'}</p>
            {brand.address_line_1 && <p className="text-slate-500">{brand.address_line_1}</p>}
            {brand.address_city && (
              <p className="text-slate-500">
                {brand.address_city}
                {brand.address_postcode ? `, ${brand.address_postcode}` : ''}
              </p>
            )}
            {brand.vat_number && <p className="text-slate-500">VAT: {brand.vat_number}</p>}
          </div>
          <div className="ml-auto text-right">
            <p className="font-semibold">Invoice {invoice.invoice_number || invoice.id.slice(0, 8)}</p>
            <p className="text-slate-500">Issued: {formatDate(invoice.issued_at)}</p>
            <p className="text-slate-500">Due: {formatDate(invoice.due_date)}</p>
            <p className="text-slate-500 mt-1">
              Bill to: {contact.first_name} {contact.last_name || ''}
            </p>
          </div>
        </div>
      )

    case 'line_items_table': {
      const columns = block.config.columns
      return (
        <div className="py-4">
          {invoice.lineItems.length === 0 ? (
            <p className="text-slate-400 italic py-6 text-center border border-dashed border-slate-200 rounded">
              No line items on this invoice.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  {columns.map((col) => (
                    <th key={col} className={`py-2 ${col === 'description' ? '' : 'text-right'}`}>
                      {COLUMN_LABELS[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...invoice.lineItems]
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      {columns.map((col) => (
                        <td key={col} className={`py-2 ${col === 'description' ? '' : 'text-right'}`}>
                          {col === 'description' && item.description}
                          {col === 'quantity' && item.quantity}
                          {col === 'unit_price' && formatCurrency(item.unit_price)}
                          {col === 'amount' && formatCurrency(item.amount)}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )
    }

    case 'totals_summary':
      return (
        <div className="py-4 flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {block.config.showTaxBreakdown && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tax</span>
                <span>{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-slate-300 pt-1 mt-1">
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      )

    case 'terms_text':
      if (!block.config.show || !brand.terms_text) return null
      return (
        <div className="py-4 border-t border-slate-100">
          <p className="font-semibold mb-1">Terms</p>
          <p className="text-slate-500 whitespace-pre-wrap">{brand.terms_text}</p>
        </div>
      )

    case 'footer':
      return (
        <div className="py-4 border-t border-slate-200 text-slate-400 flex justify-between flex-wrap gap-x-4 gap-y-1">
          <span>{block.config.customText || ''}</span>
          {block.config.showPageNumber && <span>Page 1</span>}
        </div>
      )

    case 'spacer':
      return <div style={{ height: block.config.heightPx }} />

    case 'location_details': {
      if (!block.config.show) return null
      const job = invoice.job
      if (!job) return null
      const origin = formatAddress(job.origin_address)
      const destination = formatAddress(job.destination_address)
      return (
        <div className="py-4 border-t border-slate-100">
          <p className="font-semibold mb-2">Location &amp; Booking Details</p>
          <div className="grid grid-cols-2 gap-4 text-slate-600">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Move Date</p>
              <p>{formatDate(job.move_date)}</p>
            </div>
            {origin && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Origin</p>
                <p>{origin}</p>
              </div>
            )}
            {destination && (
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Destination</p>
                <p>{destination}</p>
              </div>
            )}
          </div>
          {job.customer_notes && (
            <div className="mt-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">Notes</p>
              <p className="text-slate-600 whitespace-pre-wrap">{job.customer_notes}</p>
            </div>
          )}
        </div>
      )
    }

    case 'payment_instructions': {
      if (!block.config.show || !brand.bank_details) return null
      return (
        <div className="py-4 border-t border-slate-100">
          <p className="font-semibold mb-1">Payment Instructions</p>
          <p className="text-slate-500 whitespace-pre-wrap">{brand.bank_details}</p>
        </div>
      )
    }

    case 'additional_details': {
      const advanceReceived = invoice.payments
        .filter((p) => p.status === 'succeeded')
        .reduce((sum, p) => sum + p.amount, 0)
      const balanceOutstanding = Math.max(invoice.total - advanceReceived, 0)
      const jobStatus = invoice.job?.status ? JOB_STATUS_LABELS[invoice.job.status] || invoice.job.status : null

      return (
        <div className="py-4 border-t border-slate-100">
          <p className="font-semibold mb-2">Additional Details</p>
          <table className="w-full text-slate-600">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5">Advance Received</td>
                <td className="py-1.5 text-right font-medium">{formatCurrency(advanceReceived)}</td>
              </tr>
              {block.config.showJobStatus && jobStatus && (
                <tr className="border-b border-slate-100">
                  <td className="py-1.5">Services Delivered</td>
                  <td className="py-1.5 text-right font-medium">{jobStatus}</td>
                </tr>
              )}
              <tr>
                <td className="py-1.5">Balance Outstanding</td>
                <td className="py-1.5 text-right font-medium">{formatCurrency(balanceOutstanding)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    }

    case 'total_in_words': {
      if (!block.config.show) return null
      return (
        <div className="py-2 text-slate-600 italic">
          {amountToWords(invoice.total)}.
        </div>
      )
    }

    case 'declaration_signature':
      return (
        <div className="py-4 border-t border-slate-100 text-slate-600">
          <p>
            <span className="font-semibold">Declaration:</span> {block.config.declarationText}
          </p>
          <p className="mt-3">
            Customer&apos;s Sign: <span className="inline-block border-b border-slate-400 w-64 ml-2">&nbsp;</span>
          </p>
        </div>
      )

    default:
      return null
  }
}
