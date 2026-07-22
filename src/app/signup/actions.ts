'use server'

import { headers } from 'next/headers'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { signupSchema, type SignupInput } from './schemas'
import { randomBytes } from 'crypto'
import { provisionTenant } from '@/modules/tenants/server/provisioning'

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

  // 1. Rate Limiting by IP
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

  // 3. Provision Tenant (Shared Orchestration)
  const result = await provisionTenant({
    companyName,
    slug,
    adminEmail: email,
    adminFullName: fullName,
    adminPassword: password,
    requireEmailConfirmation: true
  })

  if (!result.success) {
    await supabase.from('public_signup_log').insert({ 
      ip_address: ip, 
      outcome: result.errorCode === 'account_exists' ? 'account_exists' : 'provisioning_failed' 
    })
    return { success: false, error: result.error }
  }

  // 4. Explicitly send the signup confirmation email
  // provisionTenant with requireEmailConfirmation: true creates the user with email_confirm: false
  // but does NOT send the email natively via admin.createUser. We must trigger it.
  const { error: resendErr } = await supabase.auth.resend({
    type: 'signup',
    email: email
  })

  if (resendErr) {
    console.error('[Signup Action] Failed to send confirmation email:', resendErr)
    await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'email_send_failed' })
  }

  // Log success
  await supabase.from('public_signup_log').insert({ ip_address: ip, outcome: 'success', tenant_id: result.tenantId })

  return { success: true }
}
