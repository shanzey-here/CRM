'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { revalidatePath } from 'next/cache'
import { stripe } from '@/modules/payments/server/stripe'

export async function getTenants() {
  const supabase = await createClient()
  
  // 1. Strict Server-Side Guard
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  // 2. Fetch Tenants
  const { data, error } = await supabase
    .from('tenants')
    .select('*, tenant_subscriptions(*)')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`)
  }

  return data
}

export async function createTenant(formData: FormData) {
  const supabase = await createClient()

  // 1. Strict Server-Side Guard
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || user.app_metadata.is_super_admin !== true) {
    throw new Error('Unauthorized: Super Admin access required')
  }

  // 2. Validation
  const name = formData.get('name') as string
  const slug = formData.get('slug') as string
  const adminEmail = formData.get('adminEmail') as string
  const adminFullName = formData.get('adminFullName') as string

  if (!name || name.trim() === '') return { error: 'Name is required' }
  if (!slug || slug.trim() === '') return { error: 'Slug is required' }
  if (!adminEmail || adminEmail.trim() === '') return { error: 'Admin Email is required' }
  if (!adminFullName || adminFullName.trim() === '') return { error: 'Admin Full Name is required' }

  // Basic slug format validation
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { error: 'Slug can only contain lowercase letters, numbers, and hyphens' }
  }

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
    .update({ manually_suspended: true, suspension_reason: reason.trim() })
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
    .update({ manually_suspended: false, suspension_reason: null })
    .eq('tenant_id', tenantId)

  if (error) {
    return { error: `Failed to reactivate tenant: ${error.message}` }
  }

  revalidatePath('/super-admin')
  return { success: true }
}
