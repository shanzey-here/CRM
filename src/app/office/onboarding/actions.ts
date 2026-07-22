'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createInventoryItem } from '@/modules/inventory/server/repository'

export async function skipOnboardingAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata.tenant_id

  const { error } = await supabase
    .from('tenant_settings')
    .update({ onboarding_state: 'skipped' })
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to skip onboarding:', error)
    throw new Error('Failed to skip onboarding')
  }

  revalidatePath('/office', 'layout')
  redirect('/office')
}

export async function completeOnboardingAction(selectedInventory: { name: string, room: string, default_volume: number }[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata.tenant_id

  // 1. Insert selected starter inventory items
  if (selectedInventory && selectedInventory.length > 0) {
    for (const item of selectedInventory) {
      // Use the real repository function, which loops but ensures strict boundaries
      await createInventoryItem(supabase, tenantId, {
        name: item.name,
        room: item.room as any,
        default_volume: item.default_volume,
        is_active: true
      })
    }
  }

  // 2. Mark onboarding as completed
  const { error } = await supabase
    .from('tenant_settings')
    .update({ onboarding_state: 'completed' })
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('Failed to complete onboarding:', error)
    throw new Error('Failed to complete onboarding')
  }

  revalidatePath('/office', 'layout')
  redirect('/office')
}

export async function dismissOnboardingReminderAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const tenantId = user.app_metadata.tenant_id

  const { error } = await supabase
    .from('tenant_settings')
    .update({ onboarding_state: 'completed' })
    .eq('tenant_id', tenantId)
    .eq('onboarding_state', 'skipped') // Only update if it's currently skipped

  if (error) {
    console.error('Failed to dismiss onboarding reminder:', error)
    throw new Error('Failed to dismiss reminder')
  }

  revalidatePath('/office', 'layout')
}
