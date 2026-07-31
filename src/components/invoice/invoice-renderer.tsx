import { InvoiceWithDetails } from '@/modules/invoicing/schema'
import { Contact } from '@/modules/clients/server/repository'
import { InvoiceLayoutBlock } from '@/modules/settings/invoice-template/schemas'
import { Database } from '@/types/database.types'

type TenantSettings = Database['public']['Tables']['tenant_settings']['Row']

interface InvoiceRendererProps {
  blocks: InvoiceLayoutBlock[]
  invoice: InvoiceWithDetails
  tenantSettings: TenantSettings
  contact: Contact
}

function formatCurrency(amount: number) {
  return `£${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const COLUMN_LABELS: Record<string, string> = {
  description: 'Description',
  quantity: 'Qty',
  unit_price: 'Unit Price',
  amount: 'Amount',
}

// Pure presentational component — no data fetching of any kind. Every
// figure it renders comes from the invoice/tenantSettings/contact objects
// it's handed; it never reads a number out of a block's own config, because
// no block's .strict() config shape has a field capable of holding one.
export function InvoiceRenderer({ blocks, invoice, tenantSettings, contact }: InvoiceRendererProps) {
  return (
    <div className="bg-white text-slate-900 text-sm">
      {blocks.map((block, index) => (
        <InvoiceBlock key={index} block={block} invoice={invoice} tenantSettings={tenantSettings} contact={contact} />
      ))}
    </div>
  )
}

function InvoiceBlock({
  block,
  invoice,
  tenantSettings,
  contact,
}: {
  block: InvoiceLayoutBlock
  invoice: InvoiceWithDetails
  tenantSettings: TenantSettings
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
          {block.config.showLogo && tenantSettings.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenantSettings.logo_url} alt="" className="h-12 w-auto object-contain" />
          )}
          <div>
            <p className="font-bold text-lg">{tenantSettings.company_legal_name || 'Your Company'}</p>
            {tenantSettings.address_line_1 && <p className="text-slate-500">{tenantSettings.address_line_1}</p>}
            {tenantSettings.address_city && (
              <p className="text-slate-500">
                {tenantSettings.address_city}
                {tenantSettings.address_postcode ? `, ${tenantSettings.address_postcode}` : ''}
              </p>
            )}
            {tenantSettings.vat_number && <p className="text-slate-500">VAT: {tenantSettings.vat_number}</p>}
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
      if (!block.config.show || !tenantSettings.terms_template) return null
      return (
        <div className="py-4 border-t border-slate-100">
          <p className="font-semibold mb-1">Terms</p>
          <p className="text-slate-500 whitespace-pre-wrap">{tenantSettings.terms_template}</p>
        </div>
      )

    case 'footer':
      return (
        <div className="py-4 border-t border-slate-200 text-slate-400 flex justify-between">
          <span>{block.config.customText || ''}</span>
          {block.config.showPageNumber && <span>Page 1</span>}
        </div>
      )

    case 'spacer':
      return <div style={{ height: block.config.heightPx }} />

    default:
      return null
  }
}
