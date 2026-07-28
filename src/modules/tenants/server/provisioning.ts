import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { randomBytes } from 'crypto'

export interface ProvisionTenantInput {
  companyName: string
  slug: string
  adminEmail: string
  adminFullName: string
  /**
   * If a password is not provided (e.g. super-admin manual creation), 
   * the system will generate a secure random one and return it in the result.
   */
  adminPassword?: string
  /**
   * Whether to force the newly created user to confirm their email before login.
   * - Public signup: true
   * - Super-admin creation: false (waived, since it's a trusted action)
   */
  requireEmailConfirmation: boolean
}

export interface ProvisionTenantResult {
  success: boolean
  error?: string
  errorCode?: 'account_exists' | 'general'
  tenantId?: string
  /**
   * If a random password was generated (because one wasn't provided), it's returned here.
   */
  generatedPassword?: string
}

/**
 * Unified robust provisioning function used by both self-serve signup and super-admin.
 * Ensures the tenant is fully orchestrated with its first admin,
 * and completely rolls back both the DB and Auth rows if any step fails.
 */
export async function provisionTenant(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const supabase = createServiceRoleClient()
  
  const password = input.adminPassword || generateSecureRandomPassword()

  // 1. Create Tenant (Fires triggers that provision tenant_settings, pricing_settings, and a trial subscription)
  const { data: newTenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      name: input.companyName,
      slug: input.slug,
      base_currency: 'USD' // Default, can be updated later
    })
    .select()
    .single()

  if (tenantErr || !newTenant) {
    console.error('[Provisioning] Failed to create tenant:', tenantErr)
    return { success: false, error: 'Failed to create workspace. Please try again.', errorCode: 'general' }
  }

  // 2. Create Auth User
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: input.adminEmail,
    password: password,
    email_confirm: !input.requireEmailConfirmation, // If confirmation NOT required, we set email_confirm=true so they can login immediately
    user_metadata: { full_name: input.adminFullName },
    app_metadata: {
      tenant_id: newTenant.id,
      tenant_role: 'tenant_admin'
    }
  })

  // Duplicate email or general auth creation error
  if (authErr) {
    // Rollback the newly created tenant
    await supabase.from('tenants').delete().eq('id', newTenant.id)
    
    if (authErr.message.toLowerCase().includes('already registered') || authErr.message.toLowerCase().includes('already exists')) {
      return { success: false, error: 'An account with this email already exists.', errorCode: 'account_exists' }
    }
    console.error('[Provisioning] Failed to create Auth user:', authErr)
    return { success: false, error: `Failed to create account: ${authErr.message}`, errorCode: 'general' }
  }

  const authUser = authData.user
  if (!authUser) {
    await supabase.from('tenants').delete().eq('id', newTenant.id)
    return { success: false, error: 'Failed to create account (No user returned)', errorCode: 'general' }
  }

  // 3. Create Public User Record
  const { error: publicUserErr } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      tenant_id: newTenant.id,
      role: 'tenant_admin',
      full_name: input.adminFullName,
      email: input.adminEmail,
      is_active: true
    })

  // Public user insert failure
  if (publicUserErr) {
    console.error('[Provisioning] Failed to create public.users record:', publicUserErr)
    // Full Rollback: BOTH the auth user and the tenant
    await supabase.auth.admin.deleteUser(authUser.id)
    await supabase.from('tenants').delete().eq('id', newTenant.id)
    return { success: false, error: 'Failed to finalize account setup. Please try again.', errorCode: 'general' }
  }

  return { 
    success: true, 
    tenantId: newTenant.id,
    generatedPassword: !input.adminPassword ? password : undefined 
  }
}

/**
 * Generates a strong random password for super-admin-provisioned accounts.
 */
function generateSecureRandomPassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  let password = ''
  const randomBytesBuffer = randomBytes(length)
  for (let i = 0; i < length; i++) {
    // Map random byte to our character set safely
    password += chars[randomBytesBuffer[i] % chars.length]
  }
  return password
}
