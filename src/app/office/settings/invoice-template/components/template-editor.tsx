'use client'

import { useState, useTransition } from 'react'
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
import { GripVertical, Plus, X } from 'lucide-react'
import { invoiceTemplateSchema, InvoiceTemplateInput, InvoiceLayoutBlock } from '@/modules/settings/invoice-template/schemas'
import { updateInvoiceTemplateAction } from '../actions'
import { InvoiceRenderer } from '@/components/invoice/invoice-renderer'
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
}

function defaultBlockFor(type: InvoiceLayoutBlock['type']): InvoiceLayoutBlock {
  switch (type) {
    case 'header':
      return { type: 'header', config: { showLogo: true, alignment: 'left' } }
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
      return { type: 'location_details', config: { show: true } }
    case 'payment_instructions':
      return { type: 'payment_instructions', config: { show: true } }
    case 'additional_details':
      return { type: 'additional_details', config: { showJobStatus: true } }
    case 'total_in_words':
      return { type: 'total_in_words', config: { show: true } }
    case 'declaration_signature':
      return { type: 'declaration_signature', config: { declarationText: 'I have read & understood all the above terms.' } }
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

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Editor */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full lg:w-[400px] lg:flex-none">
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
              <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
        <div className="w-full lg:flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Live Preview</h3>
          <p className="text-xs text-slate-400 mb-3">Using sample placeholder data with this brand's real identity — not a real invoice.</p>
          <div className="border border-slate-200 rounded-lg shadow-sm overflow-auto max-h-[85vh] bg-slate-100 p-6">
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
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={block.config.show}
            onChange={(e) => onChange({ ...block, config: { ...block.config, show: e.target.checked } })}
          />
          Show (job date, addresses, move notes)
        </label>
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
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={block.config.showJobStatus}
            onChange={(e) => onChange({ ...block, config: { ...block.config, showJobStatus: e.target.checked } })}
          />
          Show job status row (advance/balance always shown)
        </label>
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

    default:
      return null
  }
}
