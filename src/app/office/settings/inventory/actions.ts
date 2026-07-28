'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { 
  insertInventoryItemSchema, 
  updateInventoryItemSchema 
} from '@/modules/inventory/schemas'
import { 
  createInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem 
} from '@/modules/inventory/server/repository'

// We will extract tenant logic from app_metadata.
export async function createInventoryAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) throw new Error('No tenant context')
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden')
  }

  // Parse fields
  const name = formData.get('name') as string
  const room = formData.get('room') as string
  const default_volume = formData.get('default_volume') as string
  const is_active = formData.get('is_active') === 'on' || formData.get('is_active') === 'true'

  const parsed = insertInventoryItemSchema.safeParse({
    name,
    room: room || null,
    default_volume: Number(default_volume),
    is_active
  })

  if (!parsed.success) {
    throw new Error('Invalid input data')
  }

  const { error } = await createInventoryItem(supabase, tenantId, parsed.data)
  if (error) throw new Error(`Database error: ${error.message}`)

  revalidatePath('/office/settings/inventory')
}

export async function updateInventoryAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) throw new Error('No tenant context')
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden')
  }

  // Parse fields
  const name = formData.get('name') as string
  const room = formData.get('room') as string
  const default_volume = formData.get('default_volume') as string
  const is_active = formData.get('is_active') === 'on' || formData.get('is_active') === 'true'

  const parsed = updateInventoryItemSchema.safeParse({
    name,
    room: room || null,
    default_volume: Number(default_volume),
    is_active
  })

  if (!parsed.success) {
    throw new Error('Invalid input data')
  }

  const { error } = await updateInventoryItem(supabase, tenantId, itemId, parsed.data)
  if (error) throw new Error(`Database error: ${error.message}`)

  revalidatePath('/office/settings/inventory')
}

export async function deleteInventoryAction(itemId: string) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) throw new Error('No tenant context')
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    throw new Error('Forbidden')
  }

  // This executes a soft delete as per our repository definition
  const { error } = await deleteInventoryItem(supabase, tenantId, itemId)
  if (error) throw new Error(`Database error: ${error.message}`)

  revalidatePath('/office/settings/inventory')
}
