import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function loginAs(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 60000 })
  } catch {
    console.log('  (login did not redirect away from /login within 60s)')
  }
  await page.waitForTimeout(800)
}

async function getNavLinks(page: any): Promise<string[]> {
  return page.locator('nav a').allTextContents()
}

async function main() {
  const { data: admin } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })

  // ========================================================================
  // PART A: Post-login landing page — tenant_admin and dispatcher
  // ========================================================================
  console.log('========== PART A: post-login landing page ==========')
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'admin@devtest.local', 'DevTest123!')
    console.log('tenant_admin post-login URL:', page.url())
    await page.close()
  }
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'dispatcher@devtest.local', 'DevTest123!')
    console.log('dispatcher post-login URL:', page.url())
    await page.close()
  }

  // ========================================================================
  // PART B: Nav visibility — CURRENT real entitlement state
  // (automation_workflows=true, storage_crate_tracking=true, analytics=true,
  //  social_media=absent/false)
  // ========================================================================
  console.log('\n========== PART B: nav visibility, current real entitlement state ==========')
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  await loginAs(page, 'admin@devtest.local', 'DevTest123!')
  await page.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  const navBefore = await getNavLinks(page)
  console.log('tenant_admin nav links (Social NOT entitled, Storage/Workflows/Reports entitled):', JSON.stringify(navBefore))
  console.log('  Social present:', navBefore.includes('Social'))
  console.log('  Storage present:', navBefore.includes('Storage'))
  console.log('  Reports present:', navBefore.includes('Reports'))
  console.log('  Workflows present:', navBefore.includes('Workflows'))

  console.log('\n--- Click Social (NOT entitled) ---')
  await page.click('nav a:has-text("Social")')
  await page.waitForTimeout(1000)
  const socialText = await page.textContent('body')
  console.log('Shows "not available on your current plan" message:', socialText?.toLowerCase().includes('not available on your current plan'))

  console.log('\n--- Click Storage (entitled) ---')
  await page.click('nav a:has-text("Storage")')
  await page.waitForTimeout(1000)
  const storageText = await page.textContent('body')
  console.log('Shows locked message (must be false — full access expected):', storageText?.toLowerCase().includes('not available on your current plan'))
  console.log('Storage page loaded normally (heading/text sample):', storageText?.slice(0, 150))

  console.log('\n--- Click Workflows (entitled, tenant_admin) ---')
  await page.click('nav a:has-text("Workflows")')
  await page.waitForTimeout(1000)
  const workflowsText = await page.textContent('body')
  console.log('Shows locked message (must be false — full access expected):', workflowsText?.toLowerCase().includes('not available on your current plan'))
  console.log('Workflows page loaded normally (sample):', workflowsText?.slice(0, 150))

  console.log('\n--- Click Reports (analytics entitled) ---')
  await page.click('nav a:has-text("Reports")')
  await page.waitForTimeout(1500)
  const reportsText = await page.textContent('body')
  console.log('Shows "Advanced Analytics is not available" (must be false — entitled):', reportsText?.includes('Advanced Analytics is not available'))
  console.log('Reports page sample:', reportsText?.slice(0, 200))

  await page.close()

  // ========================================================================
  // PART C: Toggle entitlements to the OPPOSITE state, re-test
  // ========================================================================
  console.log('\n========== PART C: toggled entitlement state (flip all four) ==========')
  await serviceClient.from('tenant_modules').upsert({ tenant_id: tenantId, module_key: 'social_media', enabled: true }, { onConflict: 'tenant_id,module_key' })
  await serviceClient.from('tenant_modules').update({ enabled: false }).eq('tenant_id', tenantId).eq('module_key', 'storage_crate_tracking')
  await serviceClient.from('tenant_modules').update({ enabled: false }).eq('tenant_id', tenantId).eq('module_key', 'automation_workflows')
  await serviceClient.from('tenant_modules').update({ enabled: false }).eq('tenant_id', tenantId).eq('module_key', 'analytics')
  console.log('Entitlements toggled: social_media=true, storage_crate_tracking=false, automation_workflows=false, analytics=false')

  const page2 = await browser.newPage()
  page2.setDefaultTimeout(60000)
  await loginAs(page2, 'admin@devtest.local', 'DevTest123!')
  await page2.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded' })
  await page2.waitForTimeout(1000)

  const navAfter = await getNavLinks(page2)
  console.log('\ntenant_admin nav links AFTER toggle (must be IDENTICAL to before):', JSON.stringify(navAfter))
  console.log('Nav unchanged by entitlement toggle:', JSON.stringify(navBefore) === JSON.stringify(navAfter))

  console.log('\n--- Click Social (NOW entitled) ---')
  await page2.click('nav a:has-text("Social")')
  await page2.waitForTimeout(1000)
  const socialText2 = await page2.textContent('body')
  console.log('Shows locked message (must be false — now entitled):', socialText2?.toLowerCase().includes('not available on your current plan'))
  console.log('Social page sample:', socialText2?.slice(0, 150))

  console.log('\n--- Click Storage (NOW not entitled) ---')
  await page2.click('nav a:has-text("Storage")')
  await page2.waitForTimeout(1000)
  const storageText2 = await page2.textContent('body')
  console.log('Shows "not available on your current plan":', storageText2?.toLowerCase().includes('not available on your current plan'))

  console.log('\n--- Click Workflows (nav link still visible, NOW not entitled) ---')
  await page2.click('nav a:has-text("Workflows")')
  await page2.waitForTimeout(1000)
  const workflowsText2 = await page2.textContent('body')
  console.log('Shows "not available on your current plan":', workflowsText2?.toLowerCase().includes('not available on your current plan'))

  console.log('\n--- Click Reports (analytics NOW not entitled) ---')
  await page2.click('nav a:has-text("Reports")')
  await page2.waitForTimeout(1500)
  const reportsText2 = await page2.textContent('body')
  console.log('Shows "Advanced Analytics is not available":', reportsText2?.includes('Advanced Analytics is not available'))

  await page2.close()

  // ========================================================================
  // PART D: restore original entitlement state exactly
  // ========================================================================
  await serviceClient.from('tenant_modules').update({ enabled: false }).eq('tenant_id', tenantId).eq('module_key', 'social_media')
  await serviceClient.from('tenant_modules').update({ enabled: true }).eq('tenant_id', tenantId).eq('module_key', 'storage_crate_tracking')
  await serviceClient.from('tenant_modules').update({ enabled: true }).eq('tenant_id', tenantId).eq('module_key', 'automation_workflows')
  await serviceClient.from('tenant_modules').update({ enabled: true }).eq('tenant_id', tenantId).eq('module_key', 'analytics')
  console.log('\n========== PART D: original entitlement state restored ==========')

  // ========================================================================
  // PART E: role-gating unchanged — dispatcher, crew, customer
  // ========================================================================
  console.log('\n========== PART E: role-gating unchanged ==========')
  {
    const p = await browser.newPage()
    p.setDefaultTimeout(60000)
    await loginAs(p, 'dispatcher@devtest.local', 'DevTest123!')
    await p.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1000)
    const dispatcherNav = await getNavLinks(p)
    console.log('dispatcher nav links:', JSON.stringify(dispatcherNav))
    console.log('  Workflows correctly ABSENT for dispatcher (role-gated, unaffected by this fix):', !dispatcherNav.includes('Workflows'))
    console.log('  Social/Storage/Reports still present for dispatcher:', dispatcherNav.includes('Social') && dispatcherNav.includes('Storage') && dispatcherNav.includes('Reports'))
    await p.close()
  }
  {
    const p = await browser.newPage()
    p.setDefaultTimeout(60000)
    await loginAs(p, 'crew@devtest.local', 'DevTest123!')
    await p.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1000)
    console.log('crew navigating to /office -> final URL (must be redirected away):', p.url())
    await p.close()
  }
  {
    const p = await browser.newPage()
    p.setDefaultTimeout(60000)
    await loginAs(p, 'customer@devtest.local', 'DevTest123!')
    await p.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1000)
    console.log('customer navigating to /office -> final URL (must be redirected away):', p.url())
    await p.close()
  }

  await browser.close()
  console.log('\n✅ Nav audit + landing page test complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
