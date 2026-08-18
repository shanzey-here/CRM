/**
 * End-to-end verification for the Super Admin -> Tenant Admin Announcements
 * feature, against the real dev server + real seeded accounts. Produces
 * screenshots in scripts/screenshots/announcements/ and console evidence.
 *
 * Usage: npx tsx scripts/verify-announcements.ts
 * Requires: npm run dev already running on http://127.0.0.1:3000
 */

import { chromium, Browser } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const PASSWORD = 'DevTest123!'
// Deliberately OUTSIDE the project tree: writing PNGs under scripts/ triggers
// Next.js dev server's file watcher -> Fast Refresh -> remounts the page
// mid-request, which was killing in-flight Server Action calls during this
// script's own dismiss-button click. Screenshots go to the scratchpad instead.
const SCREENSHOTS_DIR = process.env.VERIFY_SCREENSHOTS_DIR || path.join(require('os').tmpdir(), 'crm-verify-announcements')
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function log(msg: string) {
  console.log(`\n=== ${msg} ===`)
}

async function login(browser: Browser, email: string) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(90000)
  page.setDefaultTimeout(90000)
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 90000 })
  await page.waitForTimeout(2500)
  return { context, page }
}

async function main() {
  // ── Fetch real fixture IDs ────────────────────────────────────────────
  const { data: tenantA } = await admin.from('tenants').select('id').eq('slug', 'dev-test-removals').single()
  const { data: tenantB } = await admin.from('tenants').select('id').eq('slug', 'second-dev-removals').single()
  if (!tenantA || !tenantB) throw new Error('Seed tenants not found — run seed scripts first')

  // Clean up any announcements from a previous run of this script.
  await admin.from('platform_announcements').delete().like('title', 'VERIFY:%')

  const browser = await chromium.launch()

  try {
    // ── 1. Super Admin creates a critical, non-dismissible, all_tenants
    // announcement through the REAL UI form (exercises RHF+zod+Server Action).
    log('1. Super Admin creates critical announcement via real UI form')
    const superAdmin = await login(browser, 'super-admin@devtest.local')
    await superAdmin.page.goto(`${BASE}/super-admin/announcements`)
    await superAdmin.page.waitForTimeout(2500)
    await superAdmin.page.click('text=New Announcement')
    await superAdmin.page.fill('input[type="text"] >> nth=0', 'VERIFY: Platform Maintenance Tonight')
    await superAdmin.page.fill('textarea', 'We will be performing scheduled maintenance from 2am-4am GMT.')
    await superAdmin.page.selectOption('select >> nth=0', 'critical')
    // Un-check "Dismissible" (checked by default)
    await superAdmin.page.uncheck('input[type="checkbox"] >> nth=0')
    await superAdmin.page.click('button:has-text("Create Announcement")')
    await superAdmin.page.waitForTimeout(2500)
    await superAdmin.page.waitForTimeout(1000)
    await superAdmin.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-super-admin-list-after-create.png'), fullPage: true })
    console.log('Super Admin announcement list screenshot saved.')

    // ── 2. tenant_admin (admin@devtest.local) logs in, sees the critical
    // banner on initial load, no close button (non-dismissible).
    log('2. tenant_admin sees critical banner on /office (initial load)')
    const tenantAdmin = await login(browser, 'admin@devtest.local')
    await tenantAdmin.page.goto(`${BASE}/office`)
    await tenantAdmin.page.waitForTimeout(2500)
    await tenantAdmin.page.waitForTimeout(1000)
    const bannerText1 = await tenantAdmin.page.locator('text=VERIFY: Platform Maintenance Tonight').count()
    console.log(`  Critical banner present on initial load: ${bannerText1 > 0}`)
    const closeButtonsOnCritical = await tenantAdmin.page
      .locator('div.flex.items-center.justify-between', { hasText: 'VERIFY: Platform Maintenance Tonight' })
      .locator('button[aria-label="Dismiss announcement"]')
      .count()
    console.log(`  Close (X) buttons on non-dismissible critical banner: ${closeButtonsOnCritical} (expect 0)`)
    await tenantAdmin.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-tenant-admin-critical-banner.png'), fullPage: true })

    // ── 3. dispatcher on the SAME /office route does NOT see the banner.
    log('3. dispatcher on /office does NOT see the banner')
    const dispatcher = await login(browser, 'dispatcher@devtest.local')
    await dispatcher.page.goto(`${BASE}/office`)
    await dispatcher.page.waitForTimeout(2500)
    await dispatcher.page.waitForTimeout(1000)
    const dispatcherSeesBanner = await dispatcher.page.locator('text=VERIFY: Platform Maintenance Tonight').count()
    console.log(`  Dispatcher sees banner: ${dispatcherSeesBanner > 0} (expect false)`)
    await dispatcher.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-dispatcher-no-banner.png'), fullPage: true })

    // ── 4. While tenant_admin's page is still open, create a second
    // ("info", specific_tenants -> Tenant A) and third ("warning", short
    // ends_at) announcement directly, and watch them arrive live via Realtime
    // with NO reload of tenantAdmin.page.
    log('4. Realtime: create 2 more announcements while tenant_admin tab stays open')
    const { data: ann2 } = await admin
      .from('platform_announcements')
      .insert({
        title: 'VERIFY: New Reporting Feature',
        body: 'Check out the new reports dashboard.',
        severity: 'info',
        target_type: 'specific_tenants',
        target_ids: [tenantA.id],
        dismissible: true,
        created_by: (await admin.from('users').select('id').eq('email', 'super-admin@devtest.local').single()).data!.id,
      })
      .select('id')
      .single()

    const { data: ann3 } = await admin
      .from('platform_announcements')
      .insert({
        title: 'VERIFY: Temporary Notice',
        body: 'This message expires shortly.',
        severity: 'warning',
        target_type: 'all_tenants',
        dismissible: true,
        ends_at: new Date(Date.now() + 12_000).toISOString(),
        created_by: (await admin.from('users').select('id').eq('email', 'super-admin@devtest.local').single()).data!.id,
      })
      .select('id')
      .single()

    console.log('  Inserted ann2 (info, specific_tenants) and ann3 (warning, 12s ends_at) via service role.')
    await tenantAdmin.page.waitForTimeout(4000) // give Realtime time to push, no reload
    await tenantAdmin.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-tenant-admin-live-realtime-stack.png'), fullPage: true })

    const bodyText = await tenantAdmin.page.locator('body').innerText()
    const orderCritical = bodyText.indexOf('VERIFY: Platform Maintenance Tonight')
    const orderWarning = bodyText.indexOf('VERIFY: Temporary Notice')
    const orderInfo = bodyText.indexOf('VERIFY: New Reporting Feature')
    console.log(`  All 3 present without reload: ${[orderCritical, orderWarning, orderInfo].every((i) => i >= 0)}`)
    console.log(`  Stacking order (should be critical < warning < info): ${orderCritical} < ${orderWarning} < ${orderInfo} => ${orderCritical < orderWarning && orderWarning < orderInfo}`)

    // ── 5. Second tenant's admin sees only the all_tenants ones, not the
    // specific_tenants one targeted at Tenant A.
    log('5. Cross-tenant isolation: Tenant B admin does not see Tenant-A-only announcement')
    const tenantBAdmin = await login(browser, 'admin@second-dev-removals.local')
    await tenantBAdmin.page.goto(`${BASE}/office`)
    await tenantBAdmin.page.waitForTimeout(2500)
    await tenantBAdmin.page.waitForTimeout(1000)
    const tenantBSeesAllTenants = await tenantBAdmin.page.locator('text=VERIFY: Platform Maintenance Tonight').count()
    const tenantBSeesSpecific = await tenantBAdmin.page.locator('text=VERIFY: New Reporting Feature').count()
    console.log(`  Tenant B admin sees all_tenants critical banner: ${tenantBSeesAllTenants > 0} (expect true)`)
    console.log(`  Tenant B admin sees Tenant-A-specific info banner: ${tenantBSeesSpecific > 0} (expect false)`)
    await tenantBAdmin.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-tenant-b-admin-isolated.png'), fullPage: true })

    // ── 6. Dismiss the info banner as admin@devtest.local; confirm it's gone,
    // persists on refresh, but a second tenant_admin (admin2) at the same
    // tenant still sees it.
    log('6. Dismiss persistence: one admin dismisses, second admin at same tenant still sees it')
    await tenantAdmin.page
      .locator('div.flex.items-center.justify-between', { hasText: 'VERIFY: New Reporting Feature' })
      .locator('button[aria-label="Dismiss announcement"]')
      .first()
      .click()
    await tenantAdmin.page.waitForTimeout(1500)
    const goneAfterDismiss = await tenantAdmin.page.locator('text=VERIFY: New Reporting Feature').count()
    console.log(`  Banner gone immediately after dismiss: ${goneAfterDismiss === 0}`)

    await tenantAdmin.page.reload()
    await tenantAdmin.page.waitForTimeout(2500)
    const stillGoneAfterReload = await tenantAdmin.page.locator('text=VERIFY: New Reporting Feature').count()
    console.log(`  Banner still gone after hard reload: ${stillGoneAfterReload === 0}`)
    await tenantAdmin.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-tenant-admin-after-dismiss-reload.png'), fullPage: true })

    const admin2 = await login(browser, 'admin2@devtest.local')
    await admin2.page.goto(`${BASE}/office`)
    await admin2.page.waitForTimeout(2500)
    await admin2.page.waitForTimeout(1000)
    const admin2StillSeesIt = await admin2.page.locator('text=VERIFY: New Reporting Feature').count()
    console.log(`  A SECOND tenant_admin at the same tenant (who didn't dismiss) still sees it: ${admin2StillSeesIt > 0} (expect true)`)
    await admin2.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-admin2-still-sees-undismissed.png'), fullPage: true })

    // ── 7. ends_at live expiry — wait past the 12s window on the ALREADY-OPEN
    // tenantAdmin tab (which currently only has the critical banner left, plus
    // whatever real-time delivered) and confirm the warning banner disappears
    // without reload.
    log('7. ends_at live expiry (no reload) on the still-open tenant_admin tab')
    const beforeExpiry = await tenantAdmin.page.locator('text=VERIFY: Temporary Notice').count()
    console.log(`  Warning banner present before expiry wait: ${beforeExpiry > 0}`)
    await tenantAdmin.page.waitForTimeout(10_000) // total wait since ann3 insert comfortably exceeds its 12s ends_at
    const afterExpiry = await tenantAdmin.page.locator('text=VERIFY: Temporary Notice').count()
    console.log(`  Warning banner gone after ends_at passed, no reload: ${afterExpiry === 0} (expect true)`)
    await tenantAdmin.page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-tenant-admin-after-live-expiry.png'), fullPage: true })

    log('DONE — see screenshots in scripts/screenshots/announcements/')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('Verification script failed:', err)
  process.exit(1)
})
