/**
 * Verifies the two fixes applied to the Schedule Survey action:
 *
 *   Gap A — § 2A partial-failure handling. scheduleSurveyAction now reuses
 *           retryStageAdvance (one retry, skip if the stage is already correct),
 *           and schedule-survey-form.tsx surfaces the resulting warning in a
 *           distinct panel instead of silently closing.
 *
 *   Gap B — appointments RLS SELECT policy. Migration
 *           20260830120000_fix_appointments_rls_tenant_claim.sql swaps the
 *           non-existent top-level `auth.jwt()->>'tenant_id'` claim for the
 *           app-wide `public.current_tenant_id()` convention, so real staff
 *           users can finally see appointments on the Unified Calendar.
 *
 * Every check that matters runs as a REAL authenticated staff user (real JWT /
 * real session), not service-role — service-role visibility is exactly the
 * false signal that hid Gap B.
 *
 * Run against a dev server on http://127.0.0.1:3000 with seeded dev accounts.
 *   npx tsx scripts/verify-schedule-survey-gap-fixes.ts
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })
const BASE = 'http://127.0.0.1:3000'
const SHOTS = path.join(__dirname, 'screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true })

let fails = 0
const check = (l: string, c: boolean, d = '') => {
  console.log(`${c ? '✓' : '✗'} ${l}${d ? ` — ${d}` : ''}`)
  if (!c) fails++
}

async function login(page: import('playwright').Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/login') && r.status() === 303, { timeout: 120000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(3000)
}

async function openSurveyModal(page: import('playwright').Page, leadId: string) {
  await page.goto(`${BASE}/office/leads/${leadId}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('button[aria-label="Schedule Survey"]', { timeout: 300000 })
  await page.waitForTimeout(2500)
  for (let i = 0; i < 3; i++) {
    await page.locator('button[aria-label="Schedule Survey"]').first().click().catch(() => {})
    if (await page.locator('#survey-title').isVisible().catch(() => false)) break
    await page.waitForTimeout(2000)
  }
  await page.waitForSelector('#survey-title', { timeout: 60000 })
}

async function run() {
  const { data: users } = await admin.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').limit(1)
  const tenantId = users![0].tenant_id as string
  const surveyorId = users![0].id as string
  const { data: brands } = await admin.from('brands').select('id').eq('tenant_id', tenantId).limit(1)
  const brandId = brands?.[0]?.id

  const mkContact = async (tag: string) =>
    (await admin.from('contacts').insert({
      tenant_id: tenantId, first_name: tag, last_name: `${tag} ${Date.now()}`,
      email: `${tag}${Date.now()}@example.com`, phone: '07000 000000',
    }).select('id').single()).data!.id
  const mkLead = async (contactId: string) =>
    (await admin.from('leads').insert({
      tenant_id: tenantId, contact_id: contactId, brand_id: brandId, stage: 'inquiry', priority: 'medium',
      preferred_move_date: new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
    }).select('id').single()).data!.id

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  page.setDefaultNavigationTimeout(300000)
  page.setDefaultTimeout(120000)
  await login(page)

  // ========================================================================
  // GAP B — real authenticated user can see appointments (incl. pre-existing)
  // ========================================================================
  console.log('\n=== GAP B: appointments RLS SELECT policy ===')
  const signIn = await createClient(URL, ANON, { auth: { persistSession: false } }).auth.signInWithPassword({
    email: 'admin@devtest.local', password: 'DevTest123!',
  })
  const token = signIn.data.session!.access_token
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
  check('real JWT has NO top-level tenant_id (the old broken policy read this)', claims.tenant_id === undefined)
  check('real JWT carries app_metadata.tenant_id (what current_tenant_id() reads)', claims.app_metadata?.tenant_id === tenantId)

  const cB = await mkContact('GapB')
  const start = new Date(); start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + 2); start.setHours(11, 0, 0, 0)
  const end = new Date(start.getTime() + 3600_000)
  const marker = `GapB-preexisting-${Date.now()}`
  const { data: pre } = await admin.from('appointments').insert({
    tenant_id: tenantId, title: marker, start_time: start.toISOString(), end_time: end.toISOString(),
    contact_id: cB, assigned_to: surveyorId, status: 'scheduled',
  }).select('id').single()

  const userDb = createClient(URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userRows, error: selErr } = await userDb.from('appointments').select('id').eq('tenant_id', tenantId)
  check('real-user SELECT on appointments returns rows (was 0 before the fix)', !selErr && (userRows?.length ?? 0) > 0,
    `err=${selErr?.message ?? 'none'} rows=${userRows?.length ?? 0}`)
  check('the PRE-EXISTING row is visible to the real user without re-creating it',
    !!userRows?.some((r) => r.id === pre!.id))

  const { data: otherTenant } = await admin.from('leads').select('tenant_id').neq('tenant_id', tenantId).limit(1)
  if (otherTenant?.[0]) {
    const { data: leak } = await userDb.from('appointments').select('id').eq('tenant_id', otherTenant[0].tenant_id)
    check("real-user still CANNOT read another tenant's appointments", (leak?.length ?? 0) === 0)
  }

  const { getUnifiedCalendarData } = await import('@/modules/calendar/server/repository')
  const wkS = new Date(start.getTime() - 3 * 86400000).toISOString()
  const wkE = new Date(start.getTime() + 4 * 86400000).toISOString()
  const { data: events } = await getUnifiedCalendarData(userDb as any, tenantId, wkS, wkE)
  const apptEvents = (events ?? []).filter((e: any) => e.type === 'appointment')
  check('getUnifiedCalendarData(realUserClient) returns it as type="appointment"',
    apptEvents.some((e: any) => e.id === pre!.id))

  const { computeConflicts } = await import('@/modules/calendar/conflict')
  const job = { id: 'j', type: 'job' as const, title: 'Job', start_time: start.toISOString(), end_time: end.toISOString(), status: 'scheduled', assigned_to: [surveyorId], raw_data: {} }
  const ae = apptEvents.find((e: any) => e.id === pre!.id)!
  check('conflict engine still flags a same-assignee overlapping job (unaffected)', !!computeConflicts([job, ae as any]).find((e: any) => e.id === pre!.id)?.hasConflict)
  check('conflict engine no false-positive on non-overlap (unaffected)', !computeConflicts([
    { ...job, start_time: new Date(end.getTime() + 3600_000).toISOString(), end_time: new Date(end.getTime() + 7200_000).toISOString() }, ae as any,
  ]).find((e: any) => e.id === pre!.id)?.hasConflict)

  // Unified Calendar UI, as the logged-in user
  await page.goto(`${BASE}/office/scheduling?view=list`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=/Dispatch Board|Calendar/i', { timeout: 300000 })
  await page.waitForTimeout(3000)
  check('appointment renders on the Unified LIST view (logged-in user)',
    await page.locator(`text=${marker}`).first().isVisible().catch(() => false))
  await page.screenshot({ path: path.join(SHOTS, 'ss-gapB-list-view.png'), fullPage: true })
  await page.goto(`${BASE}/office/scheduling?view=calendar`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=/Dispatch Board|Calendar/i', { timeout: 300000 })
  await page.waitForTimeout(3000)
  check('appointment renders on the Unified CALENDAR view (logged-in user)',
    await page.locator(`text=${marker}`).first().isVisible().catch(() => false))
  await page.screenshot({ path: path.join(SHOTS, 'ss-gapB-calendar-view.png'), fullPage: true })

  await admin.from('appointments').delete().eq('id', pre!.id)
  await admin.from('contacts').delete().eq('id', cB)

  // ========================================================================
  // GAP A (happy path) — normal flow unchanged
  // ========================================================================
  console.log('\n=== GAP A: happy path unchanged ===')
  const cH = await mkContact('GapAhappy')
  const lH = await mkLead(cH)
  await openSurveyModal(page, lH)
  await page.locator('#survey-description').fill('Happy path: normal completion.')
  await page.locator('button:has-text("Schedule Survey Appointment")').last().click()
  check('modal closes on success (onSuccess called, no § 2A panel)',
    await page.waitForSelector('#survey-title', { state: 'detached', timeout: 60000 }).then(() => true).catch(() => false))
  await page.waitForTimeout(3000)
  const { data: lHAfter } = await admin.from('leads').select('stage').eq('id', lH).single()
  check('lead auto-transitioned to survey_scheduled', lHAfter?.stage === 'survey_scheduled', `stage=${lHAfter?.stage}`)
  const { data: actsH } = await admin.from('activities').select('id, content').eq('lead_id', lH).eq('type', 'stage_change')
  check('exactly ONE stage_change activity (no duplicate from the retry)', (actsH?.length ?? 0) === 1, `count=${actsH?.length}`)
  const { data: apptH } = await admin.from('appointments').select('id').eq('contact_id', cH)
  check('appointment row created', (apptH?.length ?? 0) === 1)
  for (const a of apptH ?? []) await admin.from('appointments').delete().eq('id', a.id)
  await admin.from('activities').delete().eq('lead_id', lH)
  await admin.from('leads').delete().eq('id', lH)
  await admin.from('contacts').delete().eq('id', cH)

  // ========================================================================
  // GAP A (partial failure) — appointment created, stage-update fails
  // ========================================================================
  console.log('\n=== GAP A: § 2A partial-failure path ===')
  const cP = await mkContact('GapAfail')
  const lP = await mkLead(cP)
  await openSurveyModal(page, lP)
  await page.locator('#survey-description').fill('Partial failure: appointment persists, stage update fails.')
  await admin.from('leads').delete().eq('id', lP) // force updateLeadStage -> "Lead not found"
  await page.locator('button:has-text("Schedule Survey Appointment")').last().click()
  check('§ 2A warning is shown in the UI (not silently swallowed)',
    await page.waitForSelector('text=/could not be updated automatically/i', { timeout: 30000 }).then(() => true).catch(() => false))
  const formGone = (await page.locator('#survey-title').count()) === 0
  const greenShown = await page.locator('text=/appointment was created on the calendar/i').isVisible().catch(() => false)
  check('form replaced by the § 2A panel (modal stayed open, onSuccess NOT called)', formGone && greenShown)
  await page.screenshot({ path: path.join(SHOTS, 'ss-gapA-partial-failure-panel.png') })
  const { data: apptP } = await admin.from('appointments').select('id').eq('contact_id', cP)
  check('appointment WAS created and never rolled back (partial success)', (apptP?.length ?? 0) === 1)
  for (const a of apptP ?? []) await admin.from('appointments').delete().eq('id', a.id)
  await admin.from('contacts').delete().eq('id', cP)

  await browser.close()
  console.log(`\n${fails === 0 ? 'ALL PASSED' : `${fails} FAILED`}`)
  process.exit(fails === 0 ? 0 : 1)
}

run().catch((e) => { console.error('error:', e); process.exit(1) })
