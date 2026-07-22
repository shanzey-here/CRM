import fs from 'fs'
import path from 'path'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
console.log('--- Running Plan Limits & Gating Tests ---')

let passCount = 0
let failCount = 0

function report(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passCount++
    console.log(`PASS: ${name}`)
  } else {
    failCount++
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function run() {
  // Test 1: Static verification of the layout guard logic
  // (We use static verification here because full HTTP E2E tests for App Router layouts 
  // requires a browser or complex cookie jar which is out of scope for a basic node script,
  // same as office_layout_guard_test.ts)
  const layoutPath = path.resolve(__dirname, '../src/app/office/layout.tsx')
  const layoutContent = fs.readFileSync(layoutPath, 'utf8')

  const hasStatusCheck = layoutContent.includes("subscription?.status") || layoutContent.includes("subStatus ===")
  const hasBillingExemption = layoutContent.includes("isBillingPage = currentPath.startsWith('/office/settings/billing')") && layoutContent.includes("!isBillingPage")
  const hasRedirect = layoutContent.includes("redirect('/office/settings/billing?restricted=true')")
  const hasBanner = layoutContent.includes("subStatus === 'past_due'") && layoutContent.includes("Your last payment failed")

  report('1. Layout guard checks subscription status', hasStatusCheck)
  report('2. Layout guard exempts /office/settings/billing from hard block', hasBillingExemption)
  report('3. Layout guard hard-redirects cancelled/suspended tenants', hasRedirect)
  report('4. Layout guard renders warning banner for past_due', hasBanner)

  // Test 2: Unit test the checkTenantLimit function logic via an isolated HTTP test or unit test
  // Since entitlements.ts is server code, we can import it and test it if we mock supabase,
  // or just run it via tsx against the real DB.
  
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // We can test the helper directly via dynamic import
  const { checkTenantLimit } = await import('../src/modules/subscriptions/server/entitlements')

  const tenantId = crypto.randomUUID()
  const planId = crypto.randomUUID()
  const priceId = crypto.randomUUID()
  const email = `test_admin_${tenantId}@example.com`
  let userId = ''

  try {
    // Setup test plan with limit max_users: 1
    const { error: e1 } = await supabase.from('saas_plans').insert([
      { id: planId, name: 'Test Plan', entitlements: { max_users: 1, max_leads: 1 } }
    ])
    if (e1) throw new Error('e1 ' + e1.message)

    const { error: e2 } = await supabase.from('saas_prices').insert([
      { id: priceId, stripe_price_id: `test_price_${priceId}`, plan_id: planId }
    ])
    if (e2) throw new Error('e2 ' + e2.message)

    const { error: e3 } = await supabase.from('tenants').insert([
      { id: tenantId, name: 'Limit Test Tenant', slug: `limit-test-${tenantId}` }
    ])
    if (e3) throw new Error('e3 ' + e3.message)

    // Handle both cases (trigger ran vs trigger didn't run)
    const { error: subErr } = await supabase.from('tenant_subscriptions').upsert(
      { tenant_id: tenantId, stripe_subscription_id: 'sub_test', status: 'active', price_id: priceId },
      { onConflict: 'tenant_id' }
    )
    if (subErr) throw new Error('subErr ' + subErr.message)

    // Currently 0 users
    let res = await checkTenantLimit(supabase, tenantId, 'max_users')
    report('5. checkTenantLimit allows when current=0 and limit=1', res.allowed === true && res.limit === 1, JSON.stringify(res))

    // Real Test: Create a real auth user using the admin API
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: email,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Test Limit User' },
    })
    if (authErr) throw new Error('authErr: ' + authErr.message)
    userId = authData.user.id

    // Depending on triggers, the user might already be in public.users. If not, insert it.
    const { error: userErr } = await supabase.from('users').upsert({
      id: userId, tenant_id: tenantId, role: 'dispatcher', email: email, is_active: true, full_name: 'Test Limit User'
    }, { onConflict: 'id' })
    if (userErr) throw new Error('userErr: ' + userErr.message)

    res = await checkTenantLimit(supabase, tenantId, 'max_users')
    report('6. checkTenantLimit rejects when current=1 and limit=1', res.allowed === false && res.current === 1, JSON.stringify(res))

    // Deactivate the user
    await supabase.from('users').update({ is_active: false }).eq('id', userId)

    res = await checkTenantLimit(supabase, tenantId, 'max_users')
    report('7. checkTenantLimit ignores inactive users and allows again', res.allowed === true && res.current === 0)

  } catch (err) {
    failCount++
    console.error('Database tests failed:', err)
  } finally {
    // Cleanup
    if (userId) {
      await supabase.from('users').delete().eq('id', userId)
      await supabase.auth.admin.deleteUser(userId)
    }
    await supabase.from('tenant_subscriptions').delete().eq('tenant_id', tenantId)
    await supabase.from('tenants').delete().eq('id', tenantId)
    await supabase.from('saas_prices').delete().eq('id', priceId)
    await supabase.from('saas_plans').delete().eq('id', planId)
  }

  console.log(`\n--- Results: ${passCount} passed, ${failCount} failed ---`)
  if (failCount > 0) {
    process.exit(1)
  }
}

run()
