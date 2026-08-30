import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

const screenshotsDir = path.resolve(__dirname, 'screenshots')
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true })
}

async function verifySendQuoteAndEstimates() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  VERIFY SEND QUOTE ACTION & LEAD ESTIMATES IN QUOTE BUILDER')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // 1. Resolve test tenant & user
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id, email')
    .eq('email', 'admin@devtest.local')
    .single()

  const tenantId = user!.tenant_id!
  console.log(`✓ Tenant ID: ${tenantId}`)

  const { data: brand } = await supabaseAdmin
    .from('brands')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()
  const brandId = brand!.id

  // 2. Fixture A: Lead WITH captured estimates
  const { data: contactA } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      first_name: 'Arthur',
      last_name: 'Estimated',
      email: 'arthur.estimates@example.com',
      phone: '+44 7700 900123',
    })
    .select('id')
    .single()

  const { data: leadWithEstimates } = await supabaseAdmin
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contactA!.id,
      brand_id: brandId,
      stage: 'inquiry',
      source: 'web_widget',
      estimated_volume: 450,
      estimated_crew_size: 3,
      estimated_hours: 6,
      preferred_move_date: '2026-09-15',
    })
    .select('id')
    .single()

  const { data: quoteA } = await supabaseAdmin
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      contact_id: contactA!.id,
      lead_id: leadWithEstimates!.id,
      brand_id: brandId,
      status: 'draft',
      total_volume: 0,
      total_price: 450.0,
      computed_price: 450.0,
    })
    .select('id')
    .single()

  // 3. Fixture B: Lead WITHOUT captured estimates (all null)
  const { data: contactB } = await supabaseAdmin
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      first_name: 'Bella',
      last_name: 'NoEstimates',
      email: 'bella.noestimates@example.com',
      phone: '+44 7700 900456',
    })
    .select('id')
    .single()

  const { data: leadWithoutEstimates } = await supabaseAdmin
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contactB!.id,
      brand_id: brandId,
      stage: 'inquiry',
      source: 'phone',
      estimated_volume: null,
      estimated_crew_size: null,
      estimated_hours: null,
      preferred_move_date: '2026-09-20',
    })
    .select('id')
    .single()

  const { data: quoteB } = await supabaseAdmin
    .from('quotes')
    .insert({
      tenant_id: tenantId,
      contact_id: contactB!.id,
      lead_id: leadWithoutEstimates!.id,
      brand_id: brandId,
      status: 'draft',
      total_volume: 0,
      total_price: 0,
      computed_price: null,
    })
    .select('id')
    .single()

  console.log(`✓ Fixtures created:
    - Lead A (with estimates ~450 cu ft, 3 crew, 6 hrs): ${leadWithEstimates!.id}, Quote A: ${quoteA!.id}
    - Lead B (no estimates, all null): ${leadWithoutEstimates!.id}, Quote B: ${quoteB!.id}
  `)

  // 4. Launch Playwright browser session
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()

  const baseUrl = 'http://127.0.0.1:3000'

  try {
    // Authenticate
    console.log('--- Step 1: Logging in as Tenant Admin ---')
    await page.goto(`${baseUrl}/login`)
    await page.fill('input[name="email"]', 'admin@devtest.local')
    await page.fill('input[name="password"]', 'DevTest123!')
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/login') && res.status() === 303, { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]')
    ])
    await page.waitForTimeout(3000)
    console.log('✓ Successfully logged in.')

    // Step 2: Open Quote Workspace for Lead A (with estimates)
    console.log('\n--- Step 2: Verifying Quote Workspace for Lead WITH Estimates ---')
    await page.goto(`${baseUrl}/office/quotes/${quoteA!.id}`)
    await page.waitForSelector('text=Quote Workspace', { timeout: 15000 })
    
    // Check that LeadReferenceEstimatesBanner is rendered
    const banner = await page.waitForSelector('[data-testid="lead-reference-estimates-banner"]', { timeout: 5000 })
    const bannerText = await banner.innerText()
    console.log(`✓ Estimates Banner text: "${bannerText.replace(/\n+/g, ' ')}"`)
    
    if (!bannerText.includes('450') || !bannerText.includes('3 crew') || !bannerText.includes('6 hrs')) {
      throw new Error(`Banner does not contain expected estimates: ${bannerText}`)
    }

    const shotA = path.join(screenshotsDir, 'quote-workspace-with-lead-estimates.png')
    await page.screenshot({ path: shotA, fullPage: true })
    console.log(`✓ Screenshot saved: ${shotA}`)

    // Step 3: Open Quote Workspace for Lead B (without estimates)
    console.log('\n--- Step 3: Verifying Quote Workspace for Lead WITHOUT Estimates ---')
    await page.goto(`${baseUrl}/office/quotes/${quoteB!.id}`)
    await page.waitForSelector('text=Quote Workspace', { timeout: 15000 })

    const bannerB = await page.$('[data-testid="lead-reference-estimates-banner"]')
    if (bannerB) {
      throw new Error('Banner should NOT render when lead has no captured estimates!')
    }
    console.log('✓ Verified: No estimates banner rendered when estimates are null.')

    const shotB = path.join(screenshotsDir, 'quote-workspace-without-lead-estimates.png')
    await page.screenshot({ path: shotB, fullPage: true })
    console.log(`✓ Screenshot saved: ${shotB}`)

    // Step 4: Open Kanban Board and test "Send Quote" modal
    console.log('\n--- Step 4: Testing "Send Quote" Quick Action Modal from Kanban ---')
    await page.goto(`${baseUrl}/office/leads`)
    await page.waitForSelector(`[data-testid="lead-card-${leadWithEstimates!.id}"]`, { timeout: 15000 })

    // Find card for Arthur Estimated and click direct "Send Quote" button
    const leadCard = page.locator(`[data-testid="lead-card-${leadWithEstimates!.id}"]`).first()
    const sendQuoteBtn = leadCard.locator('button[aria-label="Send Quote"]').first()
    await sendQuoteBtn.click()

    await page.waitForSelector('[data-testid="send-quote-form"]', { timeout: 10000 })
    console.log('✓ Send Quote Modal opened successfully.')

    // Verify estimates reference appears in modal
    const modalEstimates = await page.waitForSelector('[data-testid="lead-estimates-reference"]', { timeout: 8000 })
    const modalEstimatesText = await modalEstimates.innerText()
    console.log(`✓ Modal Estimates Reference: "${modalEstimatesText.replace(/\n+/g, ' ')}"`)

    // Wait for quotes to load in modal
    await page.waitForSelector(`[data-testid="send-quote-btn-${quoteA!.id}"]`, { timeout: 10000 })

    const shotModal = path.join(screenshotsDir, 'modal-send-quote-with-estimates.png')
    await page.screenshot({ path: shotModal })
    console.log(`✓ Screenshot saved: ${shotModal}`)

    // Click "Send Proposal" button inside modal
    console.log('\n--- Step 5: Executing Send Proposal action from modal ---')
    const sendBtn = page.locator(`[data-testid="send-quote-btn-${quoteA!.id}"]`).first()
    await sendBtn.click()

    // Wait for success toast / message
    await page.waitForSelector('text=Quote marked as sent and lead advanced to Quote Sent!', { timeout: 8000 })
    console.log('✓ Success confirmation message received!')

    // Wait for modal to auto-close and Kanban to reflect stage
    await page.waitForTimeout(2000)

    // Verify DB state for quote A and lead A
    const { data: refreshedLead } = await supabaseAdmin
      .from('leads')
      .select('id, stage')
      .eq('id', leadWithEstimates!.id)
      .single()

    const { data: refreshedQuote } = await supabaseAdmin
      .from('quotes')
      .select('id, status, public_token')
      .eq('id', quoteA!.id)
      .single()

    console.log(`✓ DB State: Lead stage = ${refreshedLead?.stage}, Quote status = ${refreshedQuote?.status}, token = ${refreshedQuote?.public_token}`)

    if (refreshedLead?.stage !== 'quote_sent') {
      throw new Error(`Expected lead stage to be 'quote_sent', got: ${refreshedLead?.stage}`)
    }
    if (refreshedQuote?.status !== 'sent' || !refreshedQuote.public_token) {
      throw new Error(`Expected quote to be 'sent' with token, got: ${refreshedQuote?.status}`)
    }

    const shotKanban = path.join(screenshotsDir, 'kanban-after-quote-sent.png')
    await page.screenshot({ path: shotKanban, fullPage: true })
    console.log(`✓ Screenshot saved: ${shotKanban}`)

    console.log('\n═══════════════════════════════════════════════════════════════')
    console.log('  ALL SEND QUOTE & ESTIMATES VERIFICATIONS PASSED SUCCESSFULLY ✓')
    console.log('═══════════════════════════════════════════════════════════════\n')
  } finally {
    await browser.close()

    // Cleanup test records
    await supabaseAdmin.from('quotes').delete().in('id', [quoteA!.id, quoteB!.id])
    await supabaseAdmin.from('leads').delete().in('id', [leadWithEstimates!.id, leadWithoutEstimates!.id])
    await supabaseAdmin.from('contacts').delete().in('id', [contactA!.id, contactB!.id])
  }
}

verifySendQuoteAndEstimates().catch((err) => {
  console.error('Verification failed:', err)
  process.exit(1)
})
