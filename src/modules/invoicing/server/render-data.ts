import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getInvoiceById } from './repository'
import { InvoiceWithDetails } from '../schema'
import { getInvoiceTemplateByBrand } from '@/modules/settings/invoice-template/server/repository'
import { InvoiceLayoutBlock } from '@/modules/settings/invoice-template/schemas'
import { BrandIdentity } from '@/modules/settings/brands/schemas'
import { getContactById, Contact } from '@/modules/clients/server/repository'

export type InvoiceRenderData = {
  blocks: InvoiceLayoutBlock[]
  invoice: InvoiceWithDetails
  brand: BrandIdentity
  contact: Contact
}

// Composes the brand's current template layout with one real invoice's
// real, live financial data AND its frozen brand_snapshot — never a live
// brands join for identity fields, so an already-issued invoice can never
// silently change if the brand is edited afterward. The template's
// layout_blocks themselves are NOT part of that snapshot guarantee (a
// presentation choice, not a historical fact) — every invoice under a brand
// always renders with that brand's current layout.
export async function getInvoiceRenderData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string
): Promise<{ success: boolean; data?: InvoiceRenderData; error?: string }> {
  const invoiceResult = await getInvoiceById(supabase, tenantId, invoiceId)
  if (!invoiceResult.success || !invoiceResult.data) {
    return { success: false, error: invoiceResult.error || 'Invoice not found' }
  }

  const invoice = invoiceResult.data

  const [templateResult, contactResult] = await Promise.all([
    getInvoiceTemplateByBrand(supabase, tenantId, invoice.brand_id),
    getContactById(supabase, tenantId, invoice.contact_id),
  ])

  if (templateResult.error || !templateResult.data) {
    return { success: false, error: templateResult.error?.message || 'No invoice template found for this brand' }
  }
  if (contactResult.error || !contactResult.data) {
    return { success: false, error: contactResult.error?.message || 'Contact not found' }
  }

  return {
    success: true,
    data: {
      blocks: (templateResult.data.layout_blocks as any) || [],
      invoice,
      brand: invoice.brand_snapshot as unknown as BrandIdentity,
      contact: contactResult.data,
    },
  }
}
