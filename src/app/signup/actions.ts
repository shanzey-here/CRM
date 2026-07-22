'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { signupSchema, type SignupInput } from './schemas'
import { randomBytes } from 'crypto'

const RATE_LIMIT_WINDOW_MINUTES = 10
const RATE_LIMIT_PER_IP = 3

export async function signup(data: SignupInput) {
  const supabase = createServiceRoleClient()
  
  // Validate input
  const parsed = signupSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: 'Invalid form data' }
  }

  const { companyName, fullName, email, password } = parsed.data

  // 1. Rate Limiting by IP (reusing leads-api pattern)
  // We use a dedicated table 'public_signup_log' to track attempts.
  const headersList = await headers()
  let ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || headersList.get('x-real-ip') || 'unknown'
  
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  
  const { count: ipCount } = await supabase
    .from('public_signup_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('created_at', windowStart)

  if ((ipCount ?? 0) >= RATE_LIMIT_PER_IP) {
    await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'rate_limited' })
    return { success: false, error: 'Too many signup attempts. Please try again later.' }
  }

  // 2. Generate Tenant Slug
  const baseSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')
  const randomSuffix = randomBytes(3).toString('hex') // 6 random chars
  const slug = `${baseSlug}-${randomSuffix}`

  // 3. Create Tenant
  // This fires triggers that provision tenant_settings, pricing_settings, and a trial subscription.
  const { data: newTenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      name: companyName,
      slug: slug,
      base_currency: 'USD'
    })
    .select()
    .single()

  if (tenantErr || !newTenant) {
    await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'tenant_creation_failed' })
    return { success: false, error: 'Failed to create workspace. Please try again.' }
  }

  // 4. Create Auth User
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // Force email verification to prevent bot abuse
    user_metadata: { full_name: fullName },
    app_metadata: {
      tenant_id: newTenant.id,
      tenant_role: 'tenant_admin'
    }
  })

  // Duplicate email check
  if (authErr) {
    // Clean up the tenant we just created
    await supabase.from('tenants').delete().eq('id', newTenant.id)
    await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'auth_creation_failed' })
    
    if (authErr.message.toLowerCase().includes('already registered') || authErr.message.toLowerCase().includes('already exists')) {
      return { success: false, error: 'account_exists' } // Specific code for UI to handle
    }
    return { success: false, error: `Failed to create account: ${authErr.message}` }
  }

  const authUser = authData.user

  if (!authUser) {
    await supabase.from('tenants').delete().eq('id', newTenant.id)
    await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'auth_creation_failed_no_user' })
    return { success: false, error: 'Failed to create account' }
  }

  // 5. Create Public User Record
  const { error: publicUserErr } = await supabase
    .from('users')
    .insert({
      id: authUser.id,
      tenant_id: newTenant.id,
      role: 'tenant_admin',
      full_name: fullName,
      email: email,
      is_active: true
    })

  if (publicUserErr) {
    // Rollback BOTH the auth user and the tenant
    await supabase.auth.admin.deleteUser(authUser.id)
    await supabase.from('tenants').delete().eq('id', newTenant.id)
    await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'public_user_creation_failed' })
    return { success: false, error: 'Failed to finalize account setup. Please try again.' }
  }

  // Log success
  await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'success', tenant_id: newTenant.id })

  return { success: true }
}
