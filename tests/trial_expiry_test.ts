import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET || 'test_secret'

// Temporary mock of CRON_SECRET for test environment if not set
if (!process.env.CRON_SECRET) {
  process.env.CRON_SECRET = CRON_SECRET
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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
  console.log('--- Running Trial Expiry Cron Tests ---')

  const tenantId1 = crypto.randomUUID()
  const tenantId2 = crypto.randomUUID()
  
  try {
    // 1. Setup Test Data
    // Tenant 1: Expired Trial
    await supabase.from('tenants').insert([
      { id: tenantId1, name: 'Expired Trial Tenant', slug: `expired-trial-${tenantId1}` }
    ])
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    await supabase.from('tenant_subscriptions').upsert({
      tenant_id: tenantId1,
      status: 'trialing',
      current_period_end: pastDate.toISOString()
    }, { onConflict: 'tenant_id' })

    // Tenant 2: Active Paid (even if expired date, should be ignored because status != trialing)
    await supabase.from('tenants').insert([
      { id: tenantId2, name: 'Active Paid Tenant', slug: `active-paid-${tenantId2}` }
    ])
    await supabase.from('tenant_subscriptions').upsert({
      tenant_id: tenantId2,
      status: 'active',
      current_period_end: pastDate.toISOString()
    }, { onConflict: 'tenant_id' })

    // 2. Call the cron endpoint
    // To call the Next.js route handler, we should actually hit the HTTP endpoint if the dev server is running.
    // If not, we can import the handler directly for the test. Let's try HTTP first.
    const req = new Request(`${BASE_URL}/api/cron/trials/expire`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
    })
    
    // Instead of actual HTTP fetch which requires Next.js server to be running, 
    // we'll directly invoke the route handler to ensure this runs cleanly in a script.
    const { GET } = await import('../src/app/api/cron/trials/expire/route')
    
    // Test 1: Hit endpoint, expect tenant 1 to be processed
    const res1 = await GET(req)
    const data1 = await res1.json()
    report('1. Cron processed expired trials', data1.success === true && data1.processed >= 1)
    
    const { data: check1 } = await supabase.from('tenant_subscriptions').select('status').eq('tenant_id', tenantId1).single()
    report('2. Expired trial tenant status updated to suspended', check1?.status === 'suspended')

    const { data: check2 } = await supabase.from('tenant_subscriptions').select('status').eq('tenant_id', tenantId2).single()
    report('3. Active paid tenant untouched', check2?.status === 'active')

    // Test 2: Run second time (Idempotency)
    const res2 = await GET(req)
    const data2 = await res2.json()
    report('4. Second cron run is idempotent and processes 0 rows', data2.success === true && data2.processed === 0)

  } catch (err: any) {
    failCount++
    console.error('Test failed:', err)
  } finally {
    await supabase.from('tenant_subscriptions').delete().in('tenant_id', [tenantId1, tenantId2])
    await supabase.from('tenants').delete().in('id', [tenantId1, tenantId2])
  }

  console.log(`\n--- Results: ${passCount} passed, ${failCount} failed ---`)
  if (failCount > 0) {
    process.exit(1)
  }
}

run()
