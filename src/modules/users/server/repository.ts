import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { InviteStaffInput } from '@/modules/settings/staff/schemas'
import { randomBytes } from 'crypto'

export type TenantUser = {
  id: string
  full_name: string | null
  email: string
  role: string
  is_active: boolean
  phone: string | null
  created_at: string
}

export async function getTenantStaff(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<{ data: TenantUser[] | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, phone, created_at')
    .eq('tenant_id', tenantId)
    .in('role', ['tenant_admin', 'dispatcher', 'crew'])
    .eq('is_active', true)
    .order('full_name')

  return { data: data as TenantUser[] | null, error }
}

export async function inviteStaff(
  tenantId: string,
  inviteData: InviteStaffInput
): Promise<{ success: boolean; tempPassword?: string; error?: string }> {
  const serviceClient = createServiceRoleClient()

  // Generate a random temporary password (12 chars: alphanumeric + symbols)
  const tempPassword = randomBytes(9).toString('base64').substring(0, 12)

  try {
    // Step 1: Create auth user via service role
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: inviteData.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: inviteData.full_name },
      app_metadata: {
        tenant_role: inviteData.role,
        tenant_id: tenantId,
      },
    })

    if (createError || !created.user) {
      return {
        success: false,
        error: `Failed to create auth user: ${createError?.message || 'Unknown error'}`,
      }
    }

    // Step 2: Insert public.users row (source of truth for JWT claims via auth hook)
    const { error: insertError } = await serviceClient
      .from('users')
      .insert({
        id: created.user.id,
        tenant_id: tenantId,
        role: inviteData.role,
        full_name: inviteData.full_name,
        email: inviteData.email,
        is_active: true,
      })

    if (insertError) {
      // Rollback: delete the orphaned auth user
      const { error: deleteError } = await serviceClient.auth.admin.deleteUser(
        created.user.id
      )

      const rollbackStatus = deleteError
        ? `(rollback failed: ${deleteError.message})`
        : '(rollback successful)'

      return {
        success: false,
        error: `Failed to create staff record ${rollbackStatus}: ${insertError.message}`,
      }
    }

    return {
      success: true,
      tempPassword,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      error: `Unexpected error during invite: ${message}`,
    }
  }
}

export async function setStaffStatus(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  targetUserId: string,
  updates: { role?: string; is_active?: boolean }
): Promise<{ success: boolean; lastAdminBlocked?: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('set_staff_status', {
    p_tenant_id: tenantId,
    p_target_user_id: targetUserId,
    p_new_role: updates.role || null,
    p_new_is_active: updates.is_active !== undefined ? updates.is_active : null,
  })

  if (error) {
    // Check for the specific "last admin" error code
    if (error.code === 'P0003') {
      return {
        success: false,
        lastAdminBlocked: true,
        error: 'Cannot remove the last active tenant admin for this tenant',
      }
    }
    return {
      success: false,
      error: error.message,
    }
  }

  return { success: true }
}
