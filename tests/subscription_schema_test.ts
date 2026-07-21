import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

async function runTests() {
  console.log('🧪 Starting Subscription Schema Tests...')
  let passed = 0
  let failed = 0

  // 1. Backfill Integrity Check
  console.log('\n--- 1. Testing Backfill Integrity ---')
  const { data: legacyTenant, error: legacyErr } = await adminSupabase
    .from('tenants')
    .select('id, name')
    .eq('name', 'Dev Test Removals')
    .single()

  if (legacyErr || !legacyTenant) {
    console.error('❌ Could not find legacy tenant Dev Test Removals')
    failed++
  } else {
    const { data: sub, error: subErr } = await adminSupabase
      .from('tenant_subscriptions')
      .select('status, stripe_subscription_id')
      .eq('tenant_id', legacyTenant.id)
      .single()

    if (subErr || !sub) {
      console.error('❌ Backfill failed: No subscription found for legacy tenant')
      failed++
    } else {
      console.log(`✅ Legacy tenant successfully backfilled with status: ${sub.status}`)
      passed++
    }
  }

  // 2. New Tenant Trial Provisioning
  console.log('\n--- 2. Testing New Tenant Trial Trigger ---')
  const newSlug = `test-tenant-${Date.now()}`
  const { data: newTenant, error: createErr } = await adminSupabase
    .from('tenants')
    .insert({
      name: 'Trial Provisioning Test',
      slug: newSlug,
      base_currency: 'GBP'
    })
    .select()
    .single()

  if (createErr || !newTenant) {
    console.error('❌ Failed to create new test tenant', createErr)
    failed++
  } else {
    // Check if subscription was created
    const { data: newSub, error: newSubErr } = await adminSupabase
      .from('tenant_subscriptions')
      .select('*')
      .eq('tenant_id', newTenant.id)
      .single()

    if (newSubErr || !newSub) {
      console.error('❌ Trigger failed: No subscription auto-provisioned for new tenant', newSubErr)
      failed++
    } else if (newSub.status !== 'trialing') {
      console.error(`❌ Trigger failed: Expected status 'trialing', got '${newSub.status}'`)
      failed++
    } else if (!newSub.current_period_end) {
      console.error('❌ Trigger failed: current_period_end is null')
      failed++
    } else {
      console.log(`✅ New tenant successfully auto-provisioned with 14-day trial ending at: ${newSub.current_period_end}`)
      passed++
    }
  }

  console.log('\n================================')
  console.log(`Test Summary: ${passed} Passed | ${failed} Failed`)
  console.log('================================')
  
  if (failed > 0) process.exit(1)
}

runTests()
