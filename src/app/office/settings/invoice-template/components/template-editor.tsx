'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, X, ExternalLink } from 'lucide-react'
import { invoiceTemplateSchema, InvoiceTemplateInput, InvoiceLayoutBlock, CUSTOM_FIELD_KEYS } from '@/modules/settings/invoice-template/schemas'
import { updateInvoiceTemplateAction } from '../actions'
import { InvoiceRenderer, CUSTOM_FIELD_LABELS } from '@/components/invoice/invoice-renderer'
import { SAMPLE_INVOICE_FOR_PREVIEW, SAMPLE_CONTACT_FOR_PREVIEW } from '@/components/invoice/sample-invoice-data'
import { Brand } from '@/modules/settings/brands/server/repository'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const BLOCK_LABELS: Record<InvoiceLayoutBlock['type'], string> = {
  header: 'Header',
  line_items_table: 'Line Items Table',
  totals_summary: 'Totals Summary',
  terms_text: 'Terms Text',
  footer: 'Footer',
  spacer: 'Spacer',
  location_details: 'Location Details',
  payment_instructions: 'Payment Instructions',
  additional_details: 'Additional Details',
  total_in_words: 'Total in Words',
  declaration_signature: 'Declaration & Signature',
  custom_text: 'Custom Text',
  custom_field: 'Custom Field',
}

// Self-documentation (2a): every field a block renders, stated plainly so
// what's behind a checkbox is never a guess. Every field listed here is
// read live from the invoice/job/contact/brand at render time — none of it
// is ever stored in the block's own config.
const BLOCK_FIELD_DESCRIPTIONS: Record<InvoiceLayoutBlock['type'], string> = {
  header: 'Live fields: brand name, logo, address, VAT number — read from the brand record at render time.',
  line_items_table: 'Live fields: each line item\'s description, quantity, unit price, amount — read from invoice_line_items.',
  totals_summary: 'Live fields: subtotal, tax, total — computed live from the invoice\'s line items.',
  terms_text: 'Live field: terms copy — read from this brand\'s terms_template at render time.',
  footer: 'Live field: page number. "Custom text" below is stored template copy, not invoice data.',
  spacer: 'Layout only — renders no invoice data.',
  location_details: 'Live fields: move date, origin address, destination address, move notes — read from the invoice\'s job.',
  payment_instructions: 'Live field: bank/payment details — read from this brand\'s settings at render time.',
  additional_details: 'Live fields: advance received, job status, balance outstanding — computed live from the invoice\'s payments/total and its job\'s status.',
  total_in_words: 'Live field: invoice total, spelled out in words — computed live from invoice.total.',
  declaration_signature: 'Declaration text is stored template copy; the signature line always renders blank.',
  custom_text: 'Free text you write — stored in the template, never pulled from an invoice.',
  custom_field: 'A single field\'s live value, chosen from an allow-list of real invoice/job/customer fields — never a free-typed or financial value.',
}

function defaultBlockFor(type: InvoiceLayoutBlock['type']): InvoiceLayoutBlock {
  switch (type) {
    case 'header':
      return { type: 'header', config: { showLogo: true, alignment: 'left', logoSize: 'medium', showAddress: true, showVatNumber: true } }
    case 'line_items_table':
      return { type: 'line_items_table', config: { columns: ['description', 'quantity', 'unit_price', 'amount'] } }
    case 'totals_summary':
      return { type: 'totals_summary', config: { showTaxBreakdown: true } }
    case 'terms_text':
      return { type: 'terms_text', config: { show: true } }
    case 'footer':
      return { type: 'footer', config: { showPageNumber: true, customText: null } }
    case 'spacer':
      return { type: 'spacer', config: { heightPx: 16 } }
    case 'location_details':
      return { type: 'location_details', config: { showMoveDate: true, showOrigin: true, showDestination: true, showNotes: true } }
    case 'payment_instructions':
      return { type: 'payment_instructions', config: { show: true } }
    case 'additional_details':
      return { type: 'additional_details', config: { showAdvanceReceived: true, showJobStatus: true, showBalanceOutstanding: true } }
    case 'total_in_words':
      return { type: 'total_in_words', config: { show: true } }
    case 'declaration_signature':
      return { type: 'declaration_signature', config: { declarationText: 'I have read & understood all the above terms.' } }
    case 'custom_text':
      return { type: 'custom_text', config: { label: '', text: '' } }
    case 'custom_field':
      return { type: 'custom_field', config: { label: '', fieldKey: CUSTOM_FIELD_KEYS[0] } }
  }
}

const ALL_COLUMNS = ['description', 'quantity', 'unit_price', 'amount'] as const

interface Props {
  template: { layout_blocks: unknown }
  brand: Brand
  brands: Brand[]
}

export function TemplateEditor({ template, brand, brands }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const { control, handleSubmit, watch } = useForm<InvoiceTemplateInput>({
    resolver: zodResolver(invoiceTemplateSchema),
    defaultValues: { layout_blocks: (template.layout_blocks as InvoiceLayoutBlock[]) || [] },
  })

  const { fields, append, remove, move, update } = useFieldArray({ control, name: 'layout_blocks' })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = fields.findIndex((f) => f.id === active.id)
    const newIndex = fields.findIndex((f) => f.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex)
  }

  const watchedBlocks = watch('layout_blocks')

  const onSubmit = (data: InvoiceTemplateInput) => {
    startTransition(async () => {
      try {
        setError(null)
        const formData = new FormData()
        formData.append('brand_id', brand.id)
        formData.append('layout_blocks', JSON.stringify(data.layout_blocks))
        await updateInvoiceTemplateAction(formData)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update invoice template')
      }
    })
  }

  return (
    <div>
      {brands.length > 1 && (
        <div className="mb-6 max-w-xs">
          <label className="block text-xs font-medium text-slate-500 mb-1">Editing template for</label>
          <Select value={brand.id} onValueChange={(val) => router.push(`/office/settings/invoice-template?brand=${val}`)}>
            <SelectTrigger>
              <SelectValue>
                {() => brand.name + (brand.is_default ? ' (Default)' : '')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                  {b.is_default ? ' (Default)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-8 items-start">
        {/* Editor */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full xl:w-[400px] xl:flex-none">
          {error && <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
          {success && <div className="p-4 bg-green-50 border border-green-200 rounded text-green-700 text-sm">Invoice template updated successfully</div>}

          <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Blocks</h3>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BLOCK_LABELS) as InvoiceLayoutBlock['type'][]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => append(defaultBlockFor(type))}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors"
                  title={`Add ${BLOCK_LABELS[type]}`}
                >
                  <Plus size={12} />
                  {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>

            {fields.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No blocks yet — add one above.</p>
            ) : (
              <DndContext id="invoice-template-blocks" sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <BlockRow
                        key={field.id}
                        id={field.id}
                        block={watchedBlocks[index] as InvoiceLayoutBlock}
                        onChange={(next) => update(index, next)}
                        onRemove={() => remove(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Saving...' : 'Save Invoice Template'}
          </button>
        </form>

        {/* Live preview — sample invoice/contact data, real brand identity.
            Rendered at genuine A4 pixel width (794px @ 96dpi) inside a
            scrolling frame, so it's never squeezed into a narrow column and
            never clips content — this is what the /print route and the
            downloaded PDF will actually look like, not an approximation. */}
        <div className="w-full xl:flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-900">Live Preview</h3>
            <Link
              href={`/print/invoice-template-preview?brand=${brand.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              <ExternalLink size={14} />
              Open full preview
            </Link>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Using sample placeholder data with this brand's real identity — not a real invoice. Save your changes to see them in the full preview.
          </p>
          <div className="w-full max-w-full min-w-0 border border-slate-200 rounded-lg shadow-sm overflow-auto max-h-[85vh] bg-slate-100 p-6">
            <div className="mx-auto bg-white shadow" style={{ width: '794px', minHeight: '1123px', padding: '48px' }}>
              <InvoiceRenderer
                blocks={(watchedBlocks || []) as InvoiceLayoutBlock[]}
                invoice={SAMPLE_INVOICE_FOR_PREVIEW}
                brand={brand}
                contact={SAMPLE_CONTACT_FOR_PREVIEW}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BlockRow({
  id,
  block,
  onChange,
  onRemove,
}: {
  id: string
  block: InvoiceLayoutBlock
  onChange: (next: InvoiceLayoutBlock) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 bg-slate-50 rounded border border-slate-200 ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span {...attributes} {...listeners} className="cursor-grab text-slate-400" aria-label="Drag to reorder">
          <GripVertical size={16} />
        </span>
        <span className="font-medium text-sm text-slate-900 flex-1">{BLOCK_LABELS[block.type]}</span>
        <button type="button" onClick={onRemove} className="text-red-600 hover:bg-red-50 rounded p-1">
          <X size={14} />
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mb-2 leading-snug">{BLOCK_FIELD_DESCRIPTIONS[block.type]}</p>

      <BlockConfigForm block={block} onChange={onChange} />
    </div>
  )
}

function BlockConfigForm({ block, onChange }: { block: InvoiceLayoutBlock; onChange: (next: InvoiceLayoutBlock) => void }) {
  switch (block.type) {
    case 'header':
      return (
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showLogo}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showLogo: e.target.checked } })}
            />
            Show logo
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showAddress !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showAddress: e.target.checked } })}
            />
            Show address
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showVatNumber !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showVatNumber: e.target.checked } })}
            />
            Show VAT number
          </label>
          <label className="flex items-center gap-1">
            Alignment:
            <select
              value={block.config.alignment}
              onChange={(e) => onChange({ ...block, config: { ...block.config, alignment: e.target.value as 'left' | 'center' | 'right' } })}
              className="border border-slate-300 rounded px-1 py-0.5"
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Logo size:
            <select
              value={block.config.logoSize ?? 'medium'}
              onChange={(e) => onChange({ ...block, config: { ...block.config, logoSize: e.target.value as 'small' | 'medium' | 'large' } })}
              className="border border-slate-300 rounded px-1 py-0.5"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
      )

    case 'line_items_table':
      return (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {ALL_COLUMNS.map((col) => (
            <label key={col} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={block.config.columns.includes(col)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...block.config.columns, col]
                    : block.config.columns.filter((c) => c !== col)
                  onChange({ ...block, config: { ...block.config, columns: next } })
                }}
              />
              {col}
            </label>
          ))}
        </div>
      )

    case 'totals_summary':
      return (
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={block.config.showTaxBreakdown}
            onChange={(e) => onChange({ ...block, config: { ...block.config, showTaxBreakdown: e.target.checked } })}
          />
          Show tax breakdown
        </label>
      )

    case 'terms_text':
      return (
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={block.config.show}
            onChange={(e) => onChange({ ...block, config: { ...block.config, show: e.target.checked } })}
          />
          Show terms (from this brand's settings)
        </label>
      )

    case 'footer':
      return (
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showPageNumber}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showPageNumber: e.target.checked } })}
            />
            Show page number
          </label>
          <label className="flex items-center gap-1 flex-1 min-w-[140px]">
            Custom text:
            <input
              type="text"
              value={block.config.customText ?? ''}
              onChange={(e) => onChange({ ...block, config: { ...block.config, customText: e.target.value || null } })}
              className="border border-slate-300 rounded px-1 py-0.5 flex-1 min-w-0"
            />
          </label>
        </div>
      )

    case 'spacer':
      return (
        <label className="flex items-center gap-1 text-xs">
          Height (px):
          <input
            type="number"
            min={1}
            value={block.config.heightPx}
            onChange={(e) => onChange({ ...block, config: { ...block.config, heightPx: Number(e.target.value) || 1 } })}
            className="border border-slate-300 rounded px-1 py-0.5 w-20"
          />
        </label>
      )

    case 'location_details':
      return (
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showMoveDate !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showMoveDate: e.target.checked } })}
            />
            Move date
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showOrigin !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showOrigin: e.target.checked } })}
            />
            Origin
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showDestination !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showDestination: e.target.checked } })}
            />
            Destination
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showNotes !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showNotes: e.target.checked } })}
            />
            Move notes
          </label>
        </div>
      )

    case 'payment_instructions':
      return (
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={block.config.show}
            onChange={(e) => onChange({ ...block, config: { ...block.config, show: e.target.checked } })}
          />
          Show (from this brand's bank details)
        </label>
      )

    case 'additional_details':
      return (
        <div className="flex items-center gap-4 text-xs flex-wrap">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showAdvanceReceived !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showAdvanceReceived: e.target.checked } })}
            />
            Advance received
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showJobStatus !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showJobStatus: e.target.checked } })}
            />
            Job status
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={block.config.showBalanceOutstanding !== false}
              onChange={(e) => onChange({ ...block, config: { ...block.config, showBalanceOutstanding: e.target.checked } })}
            />
            Balance outstanding
          </label>
        </div>
      )

    case 'total_in_words':
      return (
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={block.config.show}
            onChange={(e) => onChange({ ...block, config: { ...block.config, show: e.target.checked } })}
          />
          Show
        </label>
      )

    case 'declaration_signature':
      return (
        <label className="flex items-center gap-1 text-xs">
          Declaration text:
          <input
            type="text"
            value={block.config.declarationText}
            onChange={(e) => onChange({ ...block, config: { ...block.config, declarationText: e.target.value } })}
            className="border border-slate-300 rounded px-1 py-0.5 flex-1 min-w-0"
          />
        </label>
      )

    case 'custom_text':
      return (
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="flex items-center gap-1">
            Label:
            <input
              type="text"
              value={block.config.label}
              onChange={(e) => onChange({ ...block, config: { ...block.config, label: e.target.value } })}
              className="border border-slate-300 rounded px-1 py-0.5 flex-1 min-w-0"
              placeholder="Optional heading"
            />
          </label>
          <label className="flex flex-col gap-1">
            Text:
            <textarea
              value={block.config.text}
              onChange={(e) => onChange({ ...block, config: { ...block.config, text: e.target.value } })}
              className="border border-slate-300 rounded px-1 py-1 w-full min-h-[60px]"
              placeholder="Free text for this template"
            />
          </label>
        </div>
      )

    case 'custom_field':
      return (
        <div className="flex flex-col gap-1.5 text-xs">
          <label className="flex items-center gap-1">
            Label:
            <input
              type="text"
              value={block.config.label}
              onChange={(e) => onChange({ ...block, config: { ...block.config, label: e.target.value } })}
              className="border border-slate-300 rounded px-1 py-0.5 flex-1 min-w-0"
              placeholder={CUSTOM_FIELD_LABELS[block.config.fieldKey]}
            />
          </label>
          <label className="flex items-center gap-1">
            Field:
            <select
              value={block.config.fieldKey}
              onChange={(e) => onChange({ ...block, config: { ...block.config, fieldKey: e.target.value as typeof CUSTOM_FIELD_KEYS[number] } })}
              className="border border-slate-300 rounded px-1 py-0.5 flex-1 min-w-0"
            >
              {CUSTOM_FIELD_KEYS.map((key) => (
                <option key={key} value={key}>{CUSTOM_FIELD_LABELS[key]}</option>
              ))}
            </select>
          </label>
        </div>
      )

    default:
      return null
  }
}
