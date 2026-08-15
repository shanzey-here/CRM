import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InvoiceLayoutBlock } from '../schemas'

// Brand-owned, not tenant-owned: invoice_templates.brand_id is UNIQUE, so
// "the tenant's template" no longer exists as a concept — every call site
// must know which brand's template it wants.
export async function getInvoiceTemplateByBrand(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  brandId: string
) {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('brand_id', brandId)
    .single()

  return { data, error }
}

export async function updateInvoiceTemplate(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  brandId: string,
  layoutBlocks: InvoiceLayoutBlock[]
) {
  const { data, error } = await supabase
    .from('invoice_templates')
    .update({ layout_blocks: layoutBlocks as any })
    .eq('tenant_id', tenantId)
    .eq('brand_id', brandId)
    .select()
    .single()

  return { data, error }
}
