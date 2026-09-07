'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import { stripe } from '@/modules/payments/server/stripe'

import { createTenantSchema, type CreateTenantInput } from '@/modules/tenants/schemas'

export async function getTenants() {
  const supabase = await createClient()
  
  // 1. Strict Server-Side Guard
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  // 2. Fetch Tenants with full subscription and plan information
  const { data, error } = await supabase
    .from('tenants')
    .select('*, tenant_subscriptions(*, saas_prices(*, saas_plans(*)))')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`)
  }

  return data
}

export async function createTenant(input: CreateTenantInput | FormData) {
  const supabase = await createClient()

  // 1. Strict Server-Side Guard
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  // 2. Parse & Normalize Input
  let rawData: Record<string, unknown>
  if (input instanceof FormData) {
    rawData = {
      name: input.get('name'),
      slug: input.get('slug'),
      adminEmail: input.get('adminEmail'),
      adminFullName: input.get('adminFullName') || input.get('adminName') || input.get('fullName'),
    }
  } else {
    rawData = { ...input }
  }

  // Resilient fallback for adminFullName if omitted or empty
  if (!rawData.adminFullName || typeof rawData.adminFullName !== 'string' || !rawData.adminFullName.trim()) {
    if (typeof rawData.adminEmail === 'string' && rawData.adminEmail.includes('@')) {
      const userPart = rawData.adminEmail.split('@')[0].replace(/[._-]/g, ' ')
      rawData.adminFullName = userPart.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    } else if (typeof rawData.name === 'string' && rawData.name.trim()) {
      rawData.adminFullName = `${rawData.name.trim()} Admin`
    } else {
      rawData.adminFullName = 'Workspace Admin'
    }
  }

  const parsed = createTenantSchema.safeParse(rawData)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message || 'Invalid input data'
    return { error: firstError }
  }

  const { name, slug, adminEmail, adminFullName } = parsed.data

  // 3. Uniqueness Check
  const { data: existing, error: checkError } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .single()
    
  if (existing) {
    return { error: 'A tenant with this slug already exists. Please choose a unique slug.' }
  }
  if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    return { error: 'Failed to validate slug uniqueness' }
  }

  // 4. Provision Tenant (Shared Orchestration)
  // We do NOT require email confirmation for super-admin created tenants, 
  // as it is an inherently trusted action.
  const { provisionTenant } = await import('@/modules/tenants/server/provisioning')
  
  const result = await provisionTenant({
    companyName: name.trim(),
    slug: slug.trim(),
    adminEmail: adminEmail.trim(),
    adminFullName: adminFullName.trim(),
    requireEmailConfirmation: false 
  })

  if (!result.success) {
    return { error: result.error || 'Provisioning failed' }
  }

  // 5. Revalidate
  revalidatePath('/super-admin')
  return { success: true, generatedPassword: result.generatedPassword }
}

// Reads the platform's Stripe Products/Prices and upserts them into
// saas_plans/saas_prices, keyed on the Stripe ids. Upsert, not insert-only —
// re-running after editing a price in the Dashboard updates the local row.
// Deliberately does NOT touch saas_plans.entitlements on update: entitlements
// are manually curated after first sync (Stripe metadata strings don't map
// cleanly to structured jsonb), so a fresh plan gets entitlements: {} and a
// super-admin fills it in; every later sync leaves that column alone.
export async function syncStripePlans() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  const serviceClient = createServiceRoleClient()

  const products = await stripe.products.list({ active: true, limit: 100 })
  const prices = await stripe.prices.list({ active: true, limit: 100 })

  let plansSynced = 0
  let pricesSynced = 0
  const skipped: string[] = []

  for (const product of products.data) {
    // Payload deliberately omits `entitlements` — see function comment above.
    const { error } = await serviceClient
      .from('saas_plans')
      .upsert(
        {
          stripe_product_id: product.id,
          name: product.name,
          description: product.description,
          is_active: product.active,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_product_id' }
      )

    if (error) {
      skipped.push(`Plan "${product.name}" (${product.id}): ${error.message}`)
      continue
    }
    plansSynced++
  }

  for (const price of prices.data) {
    if (!price.recurring) {
      skipped.push(`Price ${price.id}: not a recurring price, skipped (subscriptions only)`)
      continue
    }

    if (price.recurring.interval !== 'month' && price.recurring.interval !== 'year') {
      skipped.push(`Price ${price.id}: unsupported interval "${price.recurring.interval}" (only month/year), skipped`)
      continue
    }

    const productId = typeof price.product === 'string' ? price.product : price.product.id

    const { data: plan, error: planLookupError } = await serviceClient
      .from('saas_plans')
      .select('id')
      .eq('stripe_product_id', productId)
      .maybeSingle()

    if (planLookupError || !plan) {
      skipped.push(`Price ${price.id}: no synced plan for product ${productId}`)
      continue
    }

    const { error } = await serviceClient
      .from('saas_prices')
      .upsert(
        {
          stripe_price_id: price.id,
          plan_id: plan.id,
          unit_amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring.interval,
          is_active: price.active,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_price_id' }
      )

    if (error) {
      skipped.push(`Price ${price.id}: ${error.message}`)
      continue
    }
    pricesSynced++
  }

  revalidatePath('/super-admin')
  return { success: true, plansSynced, pricesSynced, skipped }
}

export async function suspendTenantAction(tenantId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }
  if (!reason || reason.trim() === '') {
    return { error: 'Suspension reason is required' }
  }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('tenant_subscriptions')
    .update({
      status: 'suspended',
      manually_suspended: true,
      suspension_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: `Failed to suspend tenant: ${error.message}` }
  }

  revalidatePath('/super-admin')
  return { success: true }
}

export async function reactivateTenantAction(tenantId: string) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  const serviceClient = createServiceRoleClient()
  const { error } = await serviceClient
    .from('tenant_subscriptions')
    .update({
      status: 'active',
      manually_suspended: false,
      suspension_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: `Failed to reactivate tenant: ${error.message}` }
  }

  revalidatePath('/super-admin')
  return { success: true }
}
