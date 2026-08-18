'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function regenerateWidgetKeyAction(brandId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    return { error: 'Unauthorized.' }
  }

  if (user.app_metadata.tenant_role !== 'tenant_admin') {
    return { error: 'Only tenant administrators can regenerate the web widget key.' }
  }

  const tenantId = user.app_metadata.tenant_id

  // We can't just use gen_random_uuid() from RPC without raw query, so we use crypto.randomUUID()
  const newKey = crypto.randomUUID()

  const { error } = await supabase
    .from('brands')
    .update({ public_widget_key: newKey })
    .eq('id', brandId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to regenerate widget key:', error)
    return { error: 'Failed to regenerate key. Please try again.' }
  }

  revalidatePath('/office/settings/web-widget')
  return { success: true }
}
