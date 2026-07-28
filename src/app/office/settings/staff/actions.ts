'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  inviteStaffSchema,
  updateStaffRoleSchema,
  deactivateStaffSchema,
} from '@/modules/settings/staff/schemas'
import {
  inviteStaff,
  setStaffStatus,
} from '@/modules/users/server/repository'

export async function inviteStaffAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    return { error: 'No tenant context' }
  }

  // HARD GUARD: only tenant_admin can invite, not dispatcher
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Only tenant admins can invite staff' }
  }

  const email = formData.get('email') as string
  const full_name = formData.get('full_name') as string
  const role = formData.get('role') as string

  const parsed = inviteStaffSchema.safeParse({ email, full_name, role })

  if (!parsed.success) {
    return { error: `Validation error: ${parsed.error.errors[0]?.message || 'Invalid input'}` }
  }

  const { checkTenantLimit } = await import('@/modules/subscriptions/server/entitlements')
  const limitCheck = await checkTenantLimit(supabase, tenantId, 'max_users')
  if (!limitCheck.allowed) {
    return { error: `You've reached your plan's limit of ${limitCheck.limit} users. Upgrade to add more.` }
  }

  const result = await inviteStaff(tenantId, parsed.data)

  if (!result.success) {
    return { error: result.error }
  }

  revalidatePath('/office/settings/staff')

  return {
    success: true,
    tempPassword: result.tempPassword,
    message: `Staff member invited successfully. Temporary password: ${result.tempPassword}`,
  }
}

export async function updateStaffRoleAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    return { error: 'No tenant context' }
  }

  // HARD GUARD: only tenant_admin can change roles
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Only tenant admins can change staff roles' }
  }

  const user_id = formData.get('user_id') as string
  const role = formData.get('role') as string

  const parsed = updateStaffRoleSchema.safeParse({ user_id, role })

  if (!parsed.success) {
    return { error: `Validation error: ${parsed.error.errors[0]?.message || 'Invalid input'}` }
  }

  const result = await setStaffStatus(supabase, tenantId, parsed.data.user_id, {
    role: parsed.data.role,
  })

  if (!result.success) {
    if (result.lastAdminBlocked) {
      return { error: result.error }
    }
    return { error: `Failed to update role: ${result.error}` }
  }

  revalidatePath('/office/settings/staff')
  return { success: true }
}

export async function deactivateStaffAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    return { error: 'No tenant context' }
  }

  // HARD GUARD: only tenant_admin can deactivate
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Only tenant admins can deactivate staff' }
  }

  const user_id = formData.get('user_id') as string

  const parsed = deactivateStaffSchema.safeParse({ user_id })

  if (!parsed.success) {
    return { error: `Validation error: ${parsed.error.errors[0]?.message || 'Invalid input'}` }
  }

  const result = await setStaffStatus(supabase, tenantId, parsed.data.user_id, {
    is_active: false,
  })

  if (!result.success) {
    if (result.lastAdminBlocked) {
      return { error: result.error }
    }
    return { error: `Failed to deactivate staff: ${result.error}` }
  }

  revalidatePath('/office/settings/staff')
  return { success: true }
}

export async function reactivateStaffAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()

  if (userErr || !user) {
    return { error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    return { error: 'No tenant context' }
  }

  // HARD GUARD: only tenant_admin can reactivate
  if (tenantRole !== 'tenant_admin') {
    return { error: 'Only tenant admins can reactivate staff' }
  }

  const user_id = formData.get('user_id') as string

  const parsed = deactivateStaffSchema.safeParse({ user_id })

  if (!parsed.success) {
    return { error: `Validation error: ${parsed.error.errors[0]?.message || 'Invalid input'}` }
  }

  const result = await setStaffStatus(supabase, tenantId, parsed.data.user_id, {
    is_active: true,
  })

  if (!result.success) {
    return { error: `Failed to reactivate staff: ${result.error}` }
  }

  revalidatePath('/office/settings/staff')
  return { success: true }
}
