import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getInvoiceById } from './repository'
import { InvoiceWithDetails } from '../schema'
import { getInvoiceTemplate } from '@/modules/settings/invoice-template/server/repository'
import { InvoiceLayoutBlock } from '@/modules/settings/invoice-template/schemas'
import { getTenantSettings } from '@/modules/settings/branding/server/repository'
import { getContactById, Contact } from '@/modules/clients/server/repository'

export type InvoiceRenderData = {
  blocks: InvoiceLayoutBlock[]
  invoice: InvoiceWithDetails
  tenantSettings: Database['public']['Tables']['tenant_settings']['Row']
  contact: Contact
}

// Composes the tenant's current template with one real invoice's real, live
// data — never anything cached in the template itself. Every piece here is
// an existing, reused fetcher (getInvoiceTemplate from invoice-editor-db,
// getInvoiceById which already joins invoice_line_items, getTenantSettings
// from branding, getContactById from clients) — nothing duplicated.
export async function getInvoiceRenderData(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  invoiceId: string
): Promise<{ success: boolean; data?: InvoiceRenderData; error?: string }> {
  const [templateResult, invoiceResult] = await Promise.all([
    getInvoiceTemplate(supabase, tenantId),
    getInvoiceById(supabase, tenantId, invoiceId),
  ])

  if (templateResult.error || !templateResult.data) {
    return { success: false, error: templateResult.error?.message || 'No invoice template found for tenant' }
  }
  if (!invoiceResult.success || !invoiceResult.data) {
    return { success: false, error: invoiceResult.error || 'Invoice not found' }
  }

  const invoice = invoiceResult.data

  const [tenantSettingsResult, contactResult] = await Promise.all([
    getTenantSettings(supabase, tenantId),
    getContactById(supabase, tenantId, invoice.contact_id),
  ])

  if (tenantSettingsResult.error || !tenantSettingsResult.data) {
    return { success: false, error: tenantSettingsResult.error?.message || 'No tenant settings found' }
  }
  if (contactResult.error || !contactResult.data) {
    return { success: false, error: contactResult.error?.message || 'Contact not found' }
  }

  return {
    success: true,
    data: {
      blocks: (templateResult.data.layout_blocks as any) || [],
      invoice,
      tenantSettings: tenantSettingsResult.data,
      contact: contactResult.data,
    },
  }
}
