import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { InvoiceLayoutBlock } from '../schemas'

export async function getInvoiceTemplate(
  supabase: SupabaseClient<Database>,
  tenantId: string
) {
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  return { data, error }
}

export async function updateInvoiceTemplate(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  layoutBlocks: InvoiceLayoutBlock[]
) {
  const { data, error } = await supabase
    .from('invoice_templates')
    .update({ layout_blocks: layoutBlocks as any })
    .eq('tenant_id', tenantId)
    .select()
    .single()

  return { data, error }
}
