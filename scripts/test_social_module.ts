import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { isSocialModuleEnabled } from '../src/modules/social/server/repository'

dotenv.config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testSocialModule() {
  console.log('--- Testing Social Module Enablement ---')
  
  // 1. Get a test tenant
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('tenant_id')
    .eq('email', 'admin@devtest.local')
    .single()
    
  if (!user) throw new Error('User not found')
  const tenantId = user.tenant_id

  console.log('Testing with tenant:', tenantId)

  // 2. Initially, it should be disabled (entitlements missing, module missing)
  let isEnabled = await isSocialModuleEnabled(supabaseAdmin, tenantId)
  console.log('Initially enabled:', isEnabled)

  // 3. Set entitlement to true (requires updating the saas_plan or mocking it)
  // To avoid breaking the actual saas_plans setup for the tenant, we'll directly inject a record into tenant_subscriptions -> saas_prices -> saas_plans.
  // Wait, the seed script already created plans. Let's just find the plan for this tenant and update its entitlements.
  const { data: sub } = await supabaseAdmin
    .from('tenant_subscriptions')
    .select('saas_prices(plan_id)')
    .eq('tenant_id', tenantId)
    .single()
    
  const planId = (sub as any)?.saas_prices?.plan_id
  
  if (planId) {
    // Save original entitlements
    const { data: plan } = await supabaseAdmin.from('saas_plans').select('entitlements').eq('id', planId).single()
    const originalEntitlements = plan?.entitlements || {}
    
    // Add social_media: true
    await supabaseAdmin.from('saas_plans').update({
      entitlements: { ...originalEntitlements, social_media: true }
    }).eq('id', planId)
    
    console.log('Added social_media: true to plan entitlements')
    
    // Test again (should still be false because tenant_modules is not set)
    isEnabled = await isSocialModuleEnabled(supabaseAdmin, tenantId)
    console.log('Enabled with only entitlement:', isEnabled)
    
    // 4. Enable in tenant_modules
    await supabaseAdmin.from('tenant_modules').insert({
      tenant_id: tenantId,
      module_key: 'social_media',
      enabled: true
    })
    console.log('Added enabled: true to tenant_modules')
    
    // Test again (should be true)
    isEnabled = await isSocialModuleEnabled(supabaseAdmin, tenantId)
    console.log('Enabled with both entitlement and module:', isEnabled)
    
    // Cleanup
    await supabaseAdmin.from('tenant_modules').delete().eq('tenant_id', tenantId).eq('module_key', 'social_media')
    await supabaseAdmin.from('saas_plans').update({ entitlements: originalEntitlements }).eq('id', planId)
    console.log('Cleanup complete')
  } else {
    console.log('No plan found for tenant')
  }
}

testSocialModule().catch(console.error)
