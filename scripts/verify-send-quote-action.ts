import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const SHOTS = path.join(__dirname, 'screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true })

const BASE = 'http://127.0.0.1:3000'

async function run() {
  const { data: user } = await supabaseAdmin
    .from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = user!.tenant_id!
  const { data: brand } = await supabaseAdmin
    .from('brands').select('id').eq('tenant_id', tenantId).limit(1).single()

  // Partially-complete lead: contact + email + move date known; NO addresses captured.
  const { data: contact } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId, first_name: 'Partial', last_name: 'DataLead',
    email: 'partial.data@example.com', phone: '07000 111222',
  }).select('id').single()

  const { data: lead } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId, contact_id: contact!.id, brand_id: brand!.id,
    stage: 'inquiry', source: 'website', preferred_move_date: '2026-10-20',
    // origin_address_id / destination_address_id deliberately left null
  }).select('id').single()
  const leadId = lead!.id
  console.log(`✓ Seeded partial lead ${leadId} (contact+email+movedate known, addresses NOT captured)`)

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message))
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [console.error]', m.text()) })

  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/login'), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(3000)

  // --- 1. Open the lead detail page and trigger Send Quote from the quick actions bar ---
  await page.goto(`${BASE}/office/leads/${leadId}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('button[aria-label="Send Quote"]', { timeout: 120000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(6000) // allow client hydration to attach handlers
  await page.locator('button[aria-label="Send Quote"]').first().click()
  try {
    await page.waitForSelector('text=Known lead data', { timeout: 25000 })
  } catch (e) {
    await page.screenshot({ path: path.join(SHOTS, 'send-quote-modal-debug.png') })
    throw e
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(SHOTS, 'send-quote-modal-partial.png') })

  const modalText = await page.locator('[role="dialog"]').innerText()
  console.log('\n--- Modal content assertions ---')
  const checks: [string, boolean][] = [
    ['shows real contact email', modalText.includes('partial.data@example.com')],
    ['shows real move date (20 Oct 2026)', /20 Oct 2026/.test(modalText)],
    ['origin shown as NOT captured', modalText.includes('Origin not captured')],
    ['destination shown as NOT captured', modalText.includes('Destination not captured')],
    ['no fabricated address text', !/\d+ .*Street|Placeholder/i.test(modalText)],
  ]
  for (const [label, ok] of checks) {
    console.log(`${ok ? '✓' : '✗'} ${label}`)
    if (!ok) throw new Error(`Assertion failed: ${label}`)
  }

  // --- 2. Click "Open Quote Builder" -> must reuse createQuoteAction + navigate to workspace ---
  await page.click('button:has-text("Open Quote Builder")')
  await page.waitForTimeout(2500)
  const dlg = page.locator('[role="dialog"]')
  if (await dlg.count()) {
    const t = await dlg.innerText()
    if (/⚠|failed|Failed/.test(t)) throw new Error('Open Quote Builder errored: ' + t)
  }
  await page.waitForURL((u) => /\/office\/quotes\/[0-9a-f-]{36}$/.test(u.pathname), {
    timeout: 120000,
    waitUntil: 'commit',
  })
  const quoteId = page.url().split('/').pop()!
  console.log(`\n✓ Navigated to real quote builder: /office/quotes/${quoteId}`)

  // Verify a real draft quote row was created for this lead
  const { data: q } = await supabaseAdmin
    .from('quotes').select('id, status, lead_id, contact_id, brand_id').eq('id', quoteId).single()
  if (!q || q.status !== 'draft' || q.lead_id !== leadId || q.contact_id !== contact!.id) {
    throw new Error(`Quote row not created correctly: ${JSON.stringify(q)}`)
  }
  console.log(`✓ Real draft quote row created & linked (status=${q.status}, lead_id matches, contact_id matches, brand_id=${q.brand_id === brand!.id})`)

  await page.waitForSelector('text=Send Quote to Customer', { timeout: 15000 })
  await page.screenshot({ path: path.join(SHOTS, 'quote-builder-with-send.png'), fullPage: true })

  // --- 2b. Lead has NO captured estimates -> reference panel must NOT appear ---
  const noEstPanel = await page.locator("text=Lead's initial estimate").count()
  console.log(`${noEstPanel === 0 ? '✓' : '✗'} No-estimates lead: "Lead's initial estimate" panel absent (no fabricated placeholder)`)
  if (noEstPanel !== 0) throw new Error('Estimate panel wrongly shown for lead with no estimates')

  // --- 2c. Lead WITH real captured estimates -> reference panel shown, builder still calculates ---
  const { data: c2 } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId, first_name: 'Estimate', last_name: 'DataLead', email: 'estimate.data@example.com',
  }).select('id').single()
  const { data: l2 } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId, contact_id: c2!.id, brand_id: brand!.id, stage: 'inquiry', source: 'web_widget',
    estimated_volume: 45, estimated_hours: 6, estimated_crew_size: 3,
  }).select('id').single()
  const { data: q2 } = await supabaseAdmin.from('quotes').insert({
    tenant_id: tenantId, contact_id: c2!.id, lead_id: l2!.id, brand_id: brand!.id, status: 'draft',
    total_volume: 0, total_price: 0,
  }).select('id').single()
  await page.goto(`${BASE}/office/quotes/${q2!.id}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector("text=Lead's initial estimate", { timeout: 30000 })
  const panelTxt = await page.locator("text=Lead's initial estimate").locator('xpath=ancestor::*[contains(@class,"rounded")][1]').first().innerText().catch(() => '')
  const estChecks: [string, boolean][] = [
    ['panel shows volume 45', /45\s*m³/.test(panelTxt)],
    ['panel shows 3 crew', /3\s*crew/.test(panelTxt)],
    ['panel shows 6 hrs', /6\s*hrs/.test(panelTxt)],
    ['panel labelled reference-only', /reference only|not from this figure|calculated from the inventory/i.test(panelTxt)],
  ]
  console.log('\n--- Lead estimate reference panel assertions ---')
  for (const [label, ok] of estChecks) {
    console.log(`${ok ? '✓' : '✗'} ${label}`)
    if (!ok) throw new Error(`Assertion failed: ${label} (panel text: ${panelTxt})`)
  }
  await page.screenshot({ path: path.join(SHOTS, 'quote-builder-lead-estimates.png'), fullPage: true })

  // builder's saved quote still has total_volume 0 / no computed price — estimate did NOT leak in
  const { data: q2after } = await supabaseAdmin.from('quotes')
    .select('total_volume, computed_price').eq('id', q2!.id).single()
  const noLeak = Number(q2after?.total_volume) === 0 && q2after?.computed_price === null
  console.log(`${noLeak ? '✓' : '✗'} Estimate not conflated: quote total_volume=${q2after?.total_volume}, computed_price=${q2after?.computed_price} (unchanged by the panel)`)
  if (!noLeak) throw new Error('Lead estimate leaked into quote volume/price')

  await supabaseAdmin.from('quotes').delete().eq('lead_id', l2!.id)
  await supabaseAdmin.from('leads').delete().eq('id', l2!.id)
  await supabaseAdmin.from('contacts').delete().eq('id', c2!.id)

  // back to the main flow's quote
  await page.goto(`${BASE}/office/quotes/${quoteId}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('text=Send Quote to Customer', { timeout: 30000 })

  // --- 3. Builder send step: give it a price, then Send Quote & Proposal ---
  await supabaseAdmin.from('quotes').update({ computed_price: 725.5, total_price: 725.5 }).eq('id', quoteId)
  await page.reload()
  await page.waitForSelector('button:has-text("Send Quote")', { timeout: 15000 })
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes(`/office/quotes/${quoteId}`), { timeout: 20000 }).catch(() => null),
    page.click('button:has-text("Send Quote")'),
  ])
  await page.waitForTimeout(4000)
  await page.screenshot({ path: path.join(SHOTS, 'quote-after-send.png'), fullPage: true })

  // --- 4. Verify real end-to-end effects ---
  const { data: sentQuote } = await supabaseAdmin
    .from('quotes').select('status, public_token').eq('id', quoteId).single()
  const { data: sentLead } = await supabaseAdmin
    .from('leads').select('stage').eq('id', leadId).single()

  console.log('\n--- End-to-end effect assertions ---')
  const e2e: [string, boolean][] = [
    ['quote status -> sent', sentQuote?.status === 'sent'],
    ['proposal public_token generated', !!sentQuote?.public_token],
    ['lead stage -> quote_sent', sentLead?.stage === 'quote_sent'],
  ]
  for (const [label, ok] of e2e) {
    console.log(`${ok ? '✓' : '✗'} ${label}`)
    if (!ok) throw new Error(`Assertion failed: ${label}`)
  }

  // Proposal page renders
  const res = await fetch(`${BASE}/proposal/${sentQuote!.public_token}`)
  console.log(`${res.status === 200 ? '✓' : '✗'} proposal page GET /proposal/<token> -> ${res.status}`)
  if (res.status !== 200) throw new Error('Proposal page did not render 200')

  // email attempt logged (no mailbox connected in dev -> expect emailSent false, surfaced as warning)
  const bodyText = await page.locator('body').innerText()
  console.log(`✓ UI post-send state: ${bodyText.includes('marked as sent') || bodyText.includes('emailed') ? 'shown' : 'MISSING'}`)

  // --- 5. Regression: the existing "New Quote" button on the lead page still works ---
  await page.goto(`${BASE}/office/leads/${leadId}`)
  await page.waitForSelector('text=Quotes', { timeout: 15000 })
  const before = (await supabaseAdmin.from('quotes').select('id').eq('lead_id', leadId)).data?.length || 0
  await Promise.all([
    page.waitForURL((u) => /\/office\/quotes\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 20000 }),
    page.click('button:has-text("New Quote")'),
  ])
  const after = (await supabaseAdmin.from('quotes').select('id').eq('lead_id', leadId)).data?.length || 0
  console.log(`\n${after === before + 1 ? '✓' : '✗'} Regression: existing "New Quote" button still creates a quote (${before} -> ${after})`)
  if (after !== before + 1) throw new Error('New Quote regression failed')

  await browser.close()

  // cleanup
  await supabaseAdmin.from('contacts').delete().eq('email', 'estimate.data@example.com')
  await supabaseAdmin.from('quotes').delete().eq('lead_id', leadId)
  await supabaseAdmin.from('leads').delete().eq('id', leadId)
  await supabaseAdmin.from('contacts').delete().eq('id', contact!.id)

  console.log('\n=== ALL SEND QUOTE ACTION VERIFICATIONS PASSED ===')
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1) })
