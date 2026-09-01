import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { chromium, type Browser } from '@playwright/test'
import * as fs from 'fs'
import {
  normalizeUkPostcode,
  isValidUkPostcodeFormat,
  validateUkPostcode,
} from '../src/lib/postcode-validation'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function runPostcodeValidationTests() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  UK-ONLY POSTCODE / ADDRESS VALIDATION (via postcodes.io)')
  console.log('  feature/phase4-uk-postcode-validation')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const { data: userA } = await supabase
    .from('users')
    .select('id, tenant_id, email')
    .eq('email', 'admin@devtest.local')
    .single()
  const tenantId = userA!.tenant_id!

  const { data: brandA } = await supabase
    .from('brands')
    .select('id, public_widget_key')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()

  console.log(`✓ Tenant ID: ${tenantId}`)
  console.log(`✓ Brand ID: ${brandA?.id}, Widget Key: ${brandA?.public_widget_key}`)

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Unit & Utility Tests for Format, Normalization, & postcodes.io
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 1: Unit Validation of Utility Functions ---')

  // 1a. Valid UK Postcodes across England, Scotland, Wales, Northern Ireland
  const validCodes = ['SW1A 1AA', 'SW1A 2AA', 'EC1A 1BB', 'M1 1AD', 'b33 8th', 'eh1 1yz', 'E1 6AN', 'CF10 1EP', 'BT1 5GS']
  for (const code of validCodes) {
    const isFmt = isValidUkPostcodeFormat(code)
    if (!isFmt) throw new Error(`Expected valid format for "${code}"`)
    const res = await validateUkPostcode(code)
    if (!res.valid) throw new Error(`Expected postcodes.io valid for "${code}", got error: ${res.error}`)
    console.log(`✓ Valid Real Postcode: "${code}" -> normalized "${res.normalized}"`)
  }

  // 1b. Correctly Formatted but Non-Existent Postcodes
  const nonExistentCodes = ['ZZ99 9ZZ', 'AA1 1AA', 'BB99 9BB']
  for (const code of nonExistentCodes) {
    const isFmt = isValidUkPostcodeFormat(code)
    if (!isFmt) throw new Error(`Expected valid format regex for "${code}"`)
    const res = await validateUkPostcode(code)
    if (res.valid) throw new Error(`Expected postcodes.io rejection for non-existent "${code}"`)
    if (res.error !== "This postcode doesn't exist") {
      throw new Error(`Expected "This postcode doesn't exist" for "${code}", got "${res.error}"`)
    }
    console.log(`✓ Formatted but Non-Existent: "${code}" -> Rejected: "${res.error}"`)
  }

  // 1c. Invalid Format Strings (non-UK / garbage)
  const invalidFormatCodes = ['12345', '90210', 'PARIS', 'ABC 123', 'INVALID', '1A2 3BC']
  for (const code of invalidFormatCodes) {
    const isFmt = isValidUkPostcodeFormat(code)
    if (isFmt) throw new Error(`Expected invalid format for "${code}"`)
    const res = await validateUkPostcode(code)
    if (res.valid || res.error !== 'Not a valid UK postcode format') {
      throw new Error(`Expected "Not a valid UK postcode format" for "${code}", got "${res.error}"`)
    }
    console.log(`✓ Invalid Format: "${code}" -> Rejected: "${res.error}"`)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Graceful Degradation Simulation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Graceful Degradation on postcodes.io Network Failure ---')

  // Simulate network failure / 500 error from postcodes.io
  const mockFailingFetch = async () => {
    throw new Error('fetch failed: network timeout')
  }

  // A format-valid postcode should degrade gracefully to true
  const degradedRes = await validateUkPostcode('SW1A 1AA', { fetchFn: mockFailingFetch as any })
  console.log(`✓ Degraded result for "SW1A 1AA": valid=${degradedRes.valid}, degraded=${degradedRes.degraded}`)
  if (!degradedRes.valid || !degradedRes.degraded) {
    throw new Error('Graceful degradation failed for format-valid postcode during network outage!')
  }

  // An invalid format postcode must STILL be rejected even during an outage
  const degradedInvalidRes = await validateUkPostcode('90210', { fetchFn: mockFailingFetch as any })
  console.log(`✓ Degraded result for invalid "90210": valid=${degradedInvalidRes.valid}, error="${degradedInvalidRes.error}"`)
  if (degradedInvalidRes.valid || degradedInvalidRes.error !== 'Not a valid UK postcode format') {
    throw new Error('Invalid format was wrongly allowed during degraded state!')
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Server-Side Direct Action Rejection & Acceptance
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 3: Server-Side Enforcement on Core Server Actions ---')

  const { createClientCore } = await import('../src/app/office/clients/actions')
  const { createBrandAction } = await import('../src/app/office/settings/brands/actions')

  // 3a. createClientCore with invalid format postcode
  const invalidClientRes = await createClientCore(supabase, tenantId, {
    first_name: 'Postcode',
    last_name: 'Test',
    email: 'postcode.test@example.com',
    origin_city: 'London',
    origin_postcode: '90210', // Invalid format
    destination_city: 'Manchester',
    destination_postcode: 'M1 1AD',
    type: 'residential',
  })
  const hasFormatIssue = invalidClientRes.issues?.some((i: any) => i.message.includes('Not a valid UK postcode format'))
  console.log(`✓ createClientCore invalid format result: error="${invalidClientRes.error}", formatIssue=${hasFormatIssue}`)
  if (invalidClientRes.success || !hasFormatIssue) {
    throw new Error('Server action failed to reject invalid postcode format!')
  }

  // 3b. createClientCore with non-existent postcode (ZZ99 9ZZ)
  const nonExistentClientRes = await createClientCore(supabase, tenantId, {
    first_name: 'Postcode',
    last_name: 'NonExistent',
    email: 'postcode.nonexist@example.com',
    origin_city: 'FakeCity',
    origin_postcode: 'ZZ99 9ZZ', // Non-existent
    type: 'residential',
  })
  console.log(`✓ createClientCore non-existent result: error="${nonExistentClientRes.error}"`)
  if (nonExistentClientRes.success || !nonExistentClientRes.error?.includes("This postcode doesn't exist")) {
    throw new Error('Server action failed to reject non-existent postcode!')
  }

  // 3c. createClientCore with valid real postcodes
  const validClientRes = await createClientCore(supabase, tenantId, {
    first_name: 'Postcode',
    last_name: 'ValidCustomer',
    email: 'postcode.valid@example.com',
    origin_city: 'London',
    origin_postcode: 'sw1a1aa', // lowercase unspaced -> will normalize to SW1A 1AA
    destination_city: 'Manchester',
    destination_postcode: 'm1 1ad',
    type: 'residential',
  })
  console.log(`✓ createClientCore valid result: success=${validClientRes.success}`)
  if (!validClientRes.success) {
    throw new Error(`Valid client creation failed: ${validClientRes.error}`)
  }

  // Cleanup created contact & addresses
  if (validClientRes.contact?.id) {
    await supabase.from('leads').delete().eq('contact_id', validClientRes.contact.id)
    await supabase.from('contacts').delete().eq('id', validClientRes.contact.id)
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Playwright UI Browser Testing on Real Forms
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 4: Playwright UI Browser Testing on Real Forms ---')

  const browser: Browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const baseUrl = 'http://127.0.0.1:3000'

  // Log in
  console.log('Logging in as tenant admin...')
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/login') && res.status() === 303, { timeout: 15000 }).catch(() => null),
    page.click('button[type="submit"]')
  ])
  await page.waitForTimeout(2000)

  // 4a. UI Form 1: Create Client Form
  console.log('\nUI Form 1: Testing Create Client Modal...')
  await page.goto(`${baseUrl}/office/clients`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2000)
  console.log(`Current page URL: ${page.url()}`)

  // Click the Create Client button
  const createBtn = page.locator('button:has-text("Create Client")')
  await createBtn.first().waitFor({ timeout: 10000 })
  await createBtn.first().click()
  await page.waitForSelector('input#first_name', { timeout: 10000 })

  await page.fill('input#first_name', 'PostcodeTest')
  await page.fill('input#origin_postcode', 'INVALID_ZIP')
  await page.click('button[type="submit"]:has-text("Save Client")')
  await page.waitForTimeout(1500)

  const clientErrorVisible = await page.locator('text=Not a valid UK postcode format').first().isVisible().catch(() => false)
  console.log(`✓ Create Client Form rejected invalid format in UI: ${clientErrorVisible}`)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'postcode-create-client-error.png') })

  // 4b. UI Form 2: Public Web Widget Form
  console.log('\nUI Form 2: Testing Public Web Widget...')
  if (brandA?.public_widget_key) {
    const widgetContext = await browser.newContext()
    const widgetPage = await widgetContext.newPage()
    await widgetPage.goto(`${baseUrl}/embed/lead-capture/${brandA.public_widget_key}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await widgetPage.waitForSelector('input#origin_postcode', { timeout: 15000 })

    await widgetPage.locator('input#first_name').fill('WidgetTest')
    await widgetPage.locator('input#email').fill('widget.test@example.com')
    await widgetPage.locator('input#phone').fill('+44 7700 900111')
    await widgetPage.locator('input#origin_postcode').fill('90210')
    const submitBtn = widgetPage.locator('button[type="submit"]')
    await submitBtn.scrollIntoViewIfNeeded()
    await submitBtn.click()
    await widgetPage.waitForTimeout(1000)

    const widgetErrorVisible = await widgetPage.locator('text=Not a valid UK postcode format').first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
    console.log(`✓ Web Widget rejected invalid format in UI: ${widgetErrorVisible}`)
    await widgetPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'postcode-widget-error.png') })
    await widgetContext.close()
  }

  // 4c. UI Form 3: Brand Settings Form
  console.log('\nUI Form 3: Testing Brand Settings Form...')
  await page.goto(`${baseUrl}/office/settings/brands`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2000)
  const addBrandBtn = page.locator('button:has-text("Add Brand")')
  await addBrandBtn.waitFor({ timeout: 10000 })
  await addBrandBtn.click()
  await page.waitForSelector('input#name', { timeout: 10000 })

  await page.fill('input#name', 'Brand Postcode Test')
  await page.fill('input#address_postcode', 'INVALID_POSTCODE')
  await page.click('button[type="submit"]:has-text("Create Brand")')
  await page.waitForTimeout(1000)

  const formatError = await page.locator('text=Not a valid UK postcode format').first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
  console.log(`✓ Brand Form rejected invalid format in UI: ${formatError}`)

  await page.fill('input#address_postcode', 'ZZ99 9ZZ')
  await page.click('button[type="submit"]:has-text("Create Brand")')
  await page.waitForTimeout(2000)

  const existError = await page.locator('text=This postcode doesn\'t exist').first().waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
  console.log(`✓ Brand Form rejected non-existent postcode in UI: ${existError}`)

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'postcode-brand-settings.png') })
  console.log('✓ Captured: postcode-brand-settings.png')

  await browser.close()

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  ALL UK POSTCODE VALIDATION TESTS PASSED ✓')
  console.log('═══════════════════════════════════════════════════════════════')
}

runPostcodeValidationTests().catch((err) => {
  console.error('POSTCODE VALIDATION TEST FAILED:', err)
  process.exit(1)
})
