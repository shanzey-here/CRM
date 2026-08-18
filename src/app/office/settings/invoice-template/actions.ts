'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { invoiceTemplateSchema } from '@/modules/settings/invoice-template/schemas'
import { updateInvoiceTemplate } from '@/modules/settings/invoice-template/server/repository'

export async function updateInvoiceTemplateAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    throw new Error('Unauthorized')
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    throw new Error('No tenant context')
  }

  // Same tier as pricing_settings/invoice_templates' own RLS — this is
  // branding-adjacent presentation config, not a financial-approval
  // decision, so tenant_admin and dispatcher both manage it.
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden')
  }

  const brandId = formData.get('brand_id') as string
  if (!brandId) {
    throw new Error('Missing brand_id')
  }

  const layoutBlocksJson = formData.get('layout_blocks') as string
  let layoutBlocks: unknown = []
  if (layoutBlocksJson) {
    try {
      layoutBlocks = JSON.parse(layoutBlocksJson)
    } catch {
      throw new Error('Invalid layout_blocks format')
    }
  }

  // Re-validated server-side regardless of client validation — never trust
  // the client alone, matching this project's established convention.
  const parsed = invoiceTemplateSchema.safeParse({ layout_blocks: layoutBlocks })
  if (!parsed.success) {
    throw new Error(`Validation error: ${parsed.error.message}`)
  }

  const { error } = await updateInvoiceTemplate(supabase, tenantId, brandId, parsed.data.layout_blocks)
  if (error) {
    throw new Error(`Database error: ${error.message}`)
  }

  revalidatePath('/office/settings/invoice-template')
}
