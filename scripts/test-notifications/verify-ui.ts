import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { chromium } from 'playwright'
import { emitEvent } from '../../src/utils/supabase/event-bus'

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function setupTestUsers() {
  console.log('[Setup] Provisioning Tenant A and Tenant B...')
  const tenantA = crypto.randomUUID()
  const tenantB = crypto.randomUUID()

  await supabase.from('tenants').insert([
    { id: tenantA, name: 'Notification Test A', slug: `notif-a-${tenantA}` },
    { id: tenantB, name: 'Notification Test B', slug: `notif-b-${tenantB}` }
  ])

  // Need active subscriptions for /office to load
  await supabase.from('tenant_subscriptions').insert([
    { tenant_id: tenantA, status: 'active', current_period_end: new Date(Date.now() + 86400000).toISOString() },
    { tenant_id: tenantB, status: 'active', current_period_end: new Date(Date.now() + 86400000).toISOString() }
  ])

  const emailA = `dispatcher-a-${Date.now()}@test.com`
  const emailB = `dispatcher-b-${Date.now()}@test.com`
  const password = 'TestPassword123!'

  console.log(`[Setup] Creating User A (${emailA}) and User B (${emailB})...`)
  const authA = await supabase.auth.admin.createUser({ email: emailA, password, email_confirm: true })
  const authB = await supabase.auth.admin.createUser({ email: emailB, password, email_confirm: true })

  const userA = authA.data.user!.id
  const userB = authB.data.user!.id

  await supabase.from('users').insert([
    { id: userA, email: emailA, full_name: 'Dispatcher A', role: 'dispatcher', tenant_id: tenantA },
    { id: userB, email: emailB, full_name: 'Dispatcher B', role: 'dispatcher', tenant_id: tenantB }
  ])

  // Required by office layout guard
  await supabase.auth.admin.updateUserById(userA, { app_metadata: { tenant_id: tenantA, tenant_role: 'dispatcher' } })
  await supabase.auth.admin.updateUserById(userB, { app_metadata: { tenant_id: tenantB, tenant_role: 'dispatcher' } })

  return { tenantA, tenantB, userA, userB, emailA, emailB, password }
}

async function runBrowserTests() {
  const { tenantA, tenantB, userA, userB, emailA, emailB, password } = await setupTestUsers()

  console.log('[Test] Launching browsers...')
  const browser = await chromium.launch({ headless: true })
  
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()

  // Inject a mock AudioContext to verify audio-autoplay (pop-ding)
  const audioMockScript = `
    window.__audioPlayed = false;
    const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
    window.AudioContext = function() {
      const ctx = new OriginalAudioContext();
      const origCreateOscillator = ctx.createOscillator.bind(ctx);
      ctx.createOscillator = function() {
        const osc = origCreateOscillator();
        const origStart = osc.start.bind(osc);
        osc.start = function(t) {
          window.__audioPlayed = true;
          origStart(t);
        };
        return osc;
      };
      return ctx;
    };
    window.webkitAudioContext = window.AudioContext;
  `;
  await contextA.addInitScript(audioMockScript);
  await contextB.addInitScript(audioMockScript);

  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  console.log('[Test] Logging in User A (Tenant A)...')
  await pageA.goto('http://localhost:3000/login')
  await pageA.fill('input[name="email"]', emailA)
  await pageA.fill('input[name="password"]', password)
  await pageA.click('button[type="submit"]')
  await pageA.waitForSelector('text=Dashboard')

  console.log('[Test] Logging in User B (Tenant B)...')
  await pageB.goto('http://localhost:3000/login')
  await pageB.fill('input[name="email"]', emailB)
  await pageB.fill('input[name="password"]', password)
  await pageB.click('button[type="submit"]')
  await pageB.waitForSelector('text=Dashboard')

  console.log('[Test] Performing user interaction to unlock AudioContext on Browser A...')
  await pageA.click('body')

  console.log('[Test] Waiting 3 seconds for Realtime WebSocket subscriptions to establish...')
  await pageA.waitForTimeout(3000)

  console.log('[Test] Both users are in their dashboards. Emitting a new lead event for Tenant A...')
  const dummyLeadId = crypto.randomUUID()
  await emitEvent(supabase, 'lead.created', 'crm', { lead_id: dummyLeadId }, tenantA)

  console.log('[Test] Waiting to verify Live Delivery and Cross-Tenant Isolation...')
  
  // Browser A should get the toast
  try {
    await pageA.waitForSelector('text=New Lead', { timeout: 5000 })
    console.log('✅ Browser A successfully received the live notification (Live Delivery works).')
  } catch (err) {
    console.error('❌ Browser A did not receive the live notification.')
    throw err
  }

  // Check audio played on A
  const audioPlayedA = await pageA.evaluate('window.__audioPlayed')
  if (audioPlayedA) {
    console.log('✅ Browser A played the pop-ding sound (Audio-Autoplay confirmed live).')
  } else {
    console.error('❌ Browser A failed to play the sound.')
    process.exit(1)
  }

  console.log('[Test] Emitting a quote.accepted event for Tenant A to verify Phase 2 sound alerts...')
  await emitEvent(supabase, 'quote.accepted', 'crm', { job_id: crypto.randomUUID() }, tenantA)

  try {
    await pageA.waitForSelector('text=Quote Accepted', { timeout: 5000 })
    console.log('✅ Browser A successfully received the live notification for Quote Accepted.')
  } catch (err) {
    console.error('❌ Browser A did not receive the Quote Accepted live notification.')
    throw err
  }

  // Browser B should NOT get the toast
  try {
    await pageB.waitForSelector('text=New Lead', { timeout: 5000 })
    console.error('❌ Browser B received the notification! Cross-Tenant Isolation via setAuth() FAILED.')
    process.exit(1)
  } catch (err) {
    console.log('✅ Browser B did NOT receive the notification (Cross-Tenant Isolation confirmed).')
  }

  console.log('[Test] Verifying Read State Interaction on Browser A...')
  // Click the Bell button to open dropdown
  await pageA.click('button:has(.lucide-bell)')
  // Click "Mark all read" in the dropdown
  await pageA.click('text=Mark all read')

  // Wait a tick for the server action to fire
  await pageA.waitForTimeout(1000)
  
  // Verify DB read_at is set for User A's notification
  const { data: notifs } = await supabase.from('notifications').select('*').eq('target_user_id', userA)
  if (notifs && notifs.length > 0 && notifs[0].read_at) {
    console.log('✅ Database correctly updated read_at state via UI click.')
  } else {
    console.error('❌ Database read_at state was not updated.')
    process.exit(1)
  }

  console.log('\n=======================================')
  console.log('✅ ALL TESTS PASSED')
  console.log('=======================================')

  await browser.close()
  process.exit(0)
}

runBrowserTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
