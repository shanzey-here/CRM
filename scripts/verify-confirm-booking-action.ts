import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
import { execSync } from 'child_process'
import { getUnifiedCalendarData } from '../src/modules/calendar/server/repository'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const SHOTS = path.join(__dirname, 'screenshots')
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true })
const BASE = 'http://127.0.0.1:3000'

let failures = 0
function assert(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

const MOVE_DATE = (() => {
  const d = new Date()
  d.setDate(d.getDate() + 4)
  return d.toISOString().slice(0, 10)
})()

async function cleanup(tag: string) {
  const { data: cs } = await db.from('contacts').select('id').eq('email', `cb.${tag}@example.com`)
  for (const c of cs || []) {
    const { data: ls } = await db.from('leads').select('id').eq('contact_id', c.id)
    for (const l of ls || []) {
      const { data: js } = await db.from('jobs').select('id').eq('contact_id', c.id)
      for (const j of js || []) {
        const { data: invs } = await db.from('invoices').select('id').eq('job_id', j.id)
        for (const inv of invs || []) {
          await db.from('invoice_line_items').delete().eq('invoice_id', inv.id)
          await db.from('payment_schedules').delete().eq('invoice_id', inv.id)
        }
        await db.from('invoices').delete().eq('job_id', j.id)
        await db.from('job_crew_assignments').delete().eq('job_id', j.id)
        await db.from('domain_events').delete().eq('payload->>job_id', j.id)
        await db.from('jobs').delete().eq('id', j.id)
      }
      await db.from('activities').delete().eq('lead_id', l.id)
      await db.from('leads').delete().eq('id', l.id)
    }
    await db.from('contacts').delete().eq('id', c.id)
  }
}

async function login(page: any) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name="email"]', 'admin@devtest.local')
  await page.fill('input[name="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r: any) => r.url().includes('/login'), { timeout: 20000 }).catch(() => null),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(3000)
}

async function openConfirmBooking(page: any, leadId: string) {
  await page.goto(`${BASE}/office/leads/${leadId}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('button[aria-label="Confirm Booking"], button[aria-label="Confirm Booking (Epic G)"]', { timeout: 120000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(5000)
  await page.locator('button[aria-label="Confirm Booking"], button[aria-label="Confirm Booking (Epic G)"]').first().click()
  await page.waitForSelector('text=Job title', { timeout: 25000 })
}

async function run() {
  await cleanup('withaddr'); await cleanup('noaddr')

  const { data: user } = await db.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = user!.tenant_id!
  const { data: brand } = await db.from('brands').select('id').eq('tenant_id', tenantId).limit(1).single()

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  page.on('pageerror', (e: any) => console.log('  [pageerror]', e.message))
  await login(page)

  // ========================================================================
  // TEST 1 — lead WITH addresses + move date on file, in `quote_sent`
  // ========================================================================
  console.log('\n=== TEST 1: happy path, addresses + move date pre-filled ===')
  const { data: c1 } = await db.from('contacts').insert({
    tenant_id: tenantId, first_name: 'ConfirmBook', last_name: 'WithAddr', email: 'cb.withaddr@example.com',
  }).select('id').single()
  const { data: oAddr } = await db.from('addresses').insert({ tenant_id: tenantId, line_1: '1 Origin St', city: 'Leeds', postcode: 'LS1 1AA' }).select('id').single()
  const { data: dAddr } = await db.from('addresses').insert({ tenant_id: tenantId, line_1: '2 Dest Rd', city: 'York', postcode: 'YO1 1BB' }).select('id').single()
  const { data: l1 } = await db.from('leads').insert({
    tenant_id: tenantId, contact_id: c1!.id, brand_id: brand!.id, stage: 'quote_sent', source: 'phone',
    preferred_move_date: MOVE_DATE, origin_address_id: oAddr!.id, destination_address_id: dAddr!.id,
  }).select('id').single()

  await openConfirmBooking(page, l1!.id)
  await page.waitForTimeout(500)
  const modalText = await page.locator('[role="dialog"]').innerText()
  assert('job title input pre-filled with contact name', (await page.inputValue('#cb-title')).includes('ConfirmBook WithAddr'), await page.inputValue('#cb-title'))
  assert('move date input pre-filled', (await page.inputValue('#cb-move-date')) === MOVE_DATE, await page.inputValue('#cb-move-date'))
  assert('both addresses shown as "On file"', (modalText.match(/On file — will be used/g) || []).length === 2)
  await page.screenshot({ path: path.join(SHOTS, 'confirm-booking-form-prefilled.png') })

  // fill the one required fresh field — price (description is pre-filled)
  await page.fill('input[placeholder="Price"]', '1450')
  await Promise.all([
    page.waitForResponse((r: any) => r.request().method() === 'POST' && r.url().includes(`/office/leads/${l1!.id}`), { timeout: 25000 }).catch(() => null),
    page.click('button:has-text("Confirm Booking & Create Job")'),
  ])
  await page.waitForTimeout(5000)

  // --- DB assertions ---
  const { data: job1 } = await db.from('jobs').select('*').eq('contact_id', c1!.id).maybeSingle()
  assert('real job created', !!job1, JSON.stringify(job1 && { status: job1.status, quote_id: job1.quote_id }))
  assert('job status = scheduled', job1?.status === 'scheduled')
  assert('job quote_id is NULL (manual, not quote-derived)', job1?.quote_id === null)
  assert('job move_date matches', job1?.move_date === MOVE_DATE)
  assert('job brand_id from lead', job1?.brand_id === brand!.id)
  assert('job origin address = lead\'s (passed through)', job1?.origin_address_id === oAddr!.id)
  assert('job destination address = lead\'s (passed through)', job1?.destination_address_id === dAddr!.id)

  const { data: inv1 } = await db.from('invoices').select('*').eq('job_id', job1!.id).maybeSingle()
  assert('draft invoice created for the job', !!inv1 && inv1.status === 'draft', inv1?.status)
  assert('invoice total = agreed price', Number(inv1?.total) === 1450 || Number(inv1?.total_amount) === 1450 || Number(inv1?.amount_due) === 1450, JSON.stringify(inv1))
  const { data: liRows } = await db.from('invoice_line_items').select('description, amount').eq('invoice_id', inv1!.id)
  assert('invoice line item carries the summary charge', (liRows || []).some((r) => /Removal service \(agreed\)/.test(r.description)))

  const { data: lead1After } = await db.from('leads').select('stage').eq('id', l1!.id).single()
  assert('lead stage -> confirmed_booking', lead1After?.stage === 'confirmed_booking', lead1After?.stage)

  const { data: acts1 } = await db.from('activities').select('type, content').eq('lead_id', l1!.id)
  const stageActs1 = (acts1 || []).filter((a) => a.type === 'stage_change')
  assert('exactly ONE stage_change activity', stageActs1.length === 1, `count=${stageActs1.length}`)
  assert('stage_change says "... to confirmed_booking"', /to confirmed_booking$/.test(stageActs1[0]?.content || ''), stageActs1[0]?.content)

  // ========================================================================
  // TEST 2 — the job shows on /office/jobs and the Unified Calendar (list view)
  // ========================================================================
  console.log('\n=== TEST 2: job appears on Jobs + Scheduling ===')
  await page.goto(`${BASE}/office/jobs`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('text=Move Date', { timeout: 30000 })
  await page.waitForTimeout(1000)
  const jobsText = await page.locator('body').innerText()
  assert('job listed on /office/jobs (contact name)', /ConfirmBook WithAddr/.test(jobsText))
  await page.screenshot({ path: path.join(SHOTS, 'confirm-booking-jobs-list.png'), fullPage: true })

  // The Unified Calendar builds job events by move_date (falls back to 9-5 when no
  // crew assignment) — assert at the repository level that this job is in that data
  // for its move-date week, exactly like any other manually-created job.
  const wkStart = `${MOVE_DATE}T00:00:00Z`
  const wkEnd = (() => { const d = new Date(MOVE_DATE); d.setDate(d.getDate() + 6); return `${d.toISOString().slice(0, 10)}T23:59:59Z` })()
  const cal = await getUnifiedCalendarData(db as any, tenantId, wkStart, wkEnd)
  const jobEvent = (cal.data || []).find((e: any) => e.id === job1!.id && e.type === 'job')
  assert('job is present in Unified Calendar data for its move date', !!jobEvent, JSON.stringify(jobEvent && { title: jobEvent.title, start: jobEvent.start_time }))
  assert('calendar event carries the job move date', (jobEvent?.start_time || '').startsWith(MOVE_DATE))

  await page.goto(`${BASE}/office/scheduling?date=${MOVE_DATE}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('text=Dispatch Board', { timeout: 30000 })
  await page.waitForTimeout(2500)
  const schedText = await page.locator('body').innerText()
  assert('scheduling calendar view shows the job event', schedText.includes(`Job #${job1!.id.substring(0, 8)}`), `looked for "Job #${job1!.id.substring(0, 8)}"`)
  await page.screenshot({ path: path.join(SHOTS, 'confirm-booking-scheduling.png'), fullPage: true })

  // ========================================================================
  // TEST 3 — lead with NO addresses, stage `inquiry` (available from any stage);
  //          addresses collected inline and real `addresses` rows created
  // ========================================================================
  console.log('\n=== TEST 3: no addresses on lead, collected inline, from `inquiry` ===')
  const { data: c3 } = await db.from('contacts').insert({
    tenant_id: tenantId, first_name: 'ConfirmBook', last_name: 'NoAddr', email: 'cb.noaddr@example.com',
  }).select('id').single()
  const { data: l3 } = await db.from('leads').insert({
    tenant_id: tenantId, contact_id: c3!.id, brand_id: brand!.id, stage: 'inquiry', source: 'walk_in',
  }).select('id').single()

  await openConfirmBooking(page, l3!.id)
  await page.waitForTimeout(500)
  const modal3 = await page.locator('[role="dialog"]').innerText()
  assert('move date renders EMPTY (not fabricated)', (await page.inputValue('#cb-move-date')) === '')
  const cityCount = await page.locator('[role="dialog"] input[placeholder="City"]').count()
  assert('inline City/Postcode inputs shown (no address on file)', !/On file — will be used/.test(modal3) && cityCount === 2, `cityInputs=${cityCount}`)

  await page.fill('#cb-move-date', MOVE_DATE)
  const cityInputs = page.locator('[role="dialog"] input[placeholder="City"]')
  const pcInputs = page.locator('[role="dialog"] input[placeholder="Postcode"]')
  await cityInputs.nth(0).fill('Bristol')
  await pcInputs.nth(0).fill('BS1 2CD')
  await cityInputs.nth(1).fill('Bath')
  await pcInputs.nth(1).fill('BA1 3EF')
  await page.fill('input[placeholder="Price"]', '900')
  await Promise.all([
    page.waitForResponse((r: any) => r.request().method() === 'POST' && r.url().includes(`/office/leads/${l3!.id}`), { timeout: 25000 }).catch(() => null),
    page.click('button:has-text("Confirm Booking & Create Job")'),
  ])
  await page.waitForTimeout(5000)

  const { data: job3 } = await db.from('jobs').select('*').eq('contact_id', c3!.id).maybeSingle()
  assert('job created from `inquiry` lead (available from any stage)', !!job3)
  assert('job has NEW origin/destination address ids (not null)', !!job3?.origin_address_id && !!job3?.destination_address_id)
  const { data: newAddrs } = await db.from('addresses').select('city').in('id', [job3!.origin_address_id, job3!.destination_address_id])
  const cities = (newAddrs || []).map((a) => a.city).sort()
  assert('inline addresses were really created', JSON.stringify(cities) === JSON.stringify(['Bath', 'Bristol']), JSON.stringify(cities))
  const { data: lead3After } = await db.from('leads').select('stage').eq('id', l3!.id).single()
  assert('lead stage -> confirmed_booking (from inquiry)', lead3After?.stage === 'confirmed_booking', lead3After?.stage)

  await browser.close()

  // ========================================================================
  // TEST 4 — regression: the shared manual-job path is untouched.
  //   - manual-job-form.tsx: byte-identical (git diff)
  //   - createManualJobAction: only the REUSE POINT comment added, no logic
  //   - and it is PROVEN WORKING end-to-end by TESTS 1 & 3, which route the
  //     Confirm Booking flow straight through createManualJobAction and got
  //     real jobs + draft invoices out.
  // (Note: the OTHER host of ManualJobForm, /office/jobs/new, has PRE-EXISTING
  //  broken imports since commit 43d4420 — `getTenantUsers` / `getContactsByTenant`
  //  no longer exist in their repos — entirely unrelated to Epic G.)
  // ========================================================================
  console.log('\n=== TEST 4: regression — shared manual-job path untouched ===')
  const mjfDiff = execSync('git diff HEAD -- src/app/office/jobs/components/manual-job-form.tsx', { encoding: 'utf8' }).trim()
  assert('manual-job-form.tsx is byte-identical (untouched)', mjfDiff === '', mjfDiff.slice(0, 200) || '(no changes)')
  const jobsActionsDiff = execSync('git diff HEAD -- src/app/office/jobs/actions.ts', { encoding: 'utf8' })
  const addedCode = jobsActionsDiff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && !/^\+\s*\/\//.test(l) && l.trim() !== '+')
  assert('jobs/actions.ts: only comment lines added (no logic change)', addedCode.length === 0, addedCode.join(' | '))

  // ========================================================================
  // TEST 5 — reuse, not duplication
  // ========================================================================
  console.log('\n=== TEST 5: reuse, not a parallel job-creation path ===')
  const rpcCallers = execSync(`git grep -l "create_manual_job_transaction" -- "src"`, { encoding: 'utf8' }).trim().split('\n')
  assert('create_manual_job_transaction RPC invoked only from jobs/actions.ts',
    rpcCallers.filter((f) => /rpc.*create_manual_job_transaction/.test(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))).every((f) => /jobs\/actions\.ts$/.test(f)),
    rpcCallers.join(', '))
  const cbAction = fs.readFileSync(path.join(__dirname, '../src/app/office/leads/actions.ts'), 'utf8')
  assert('confirmBookingAction calls createManualJobAction (the shared action)', /createManualJobAction\(\{/.test(cbAction))
  assert('confirmBookingAction does NOT call the RPC directly', !/rpc\(\s*['"]create_manual_job_transaction/.test(cbAction))
  const diffStat = execSync('git diff --stat HEAD -- src/app/office/jobs/actions.ts src/app/office/jobs/components/manual-job-form.tsx src/modules/jobs', { encoding: 'utf8' }).trim()
  assert('manual-job-form.tsx + jobs module: no logic changes (only the REUSE POINT comment in actions.ts)',
    !/manual-job-form|schema\.ts|repository\.ts/.test(diffStat), diffStat || '(no changes)')

  await cleanup('withaddr'); await cleanup('noaddr')
  console.log(`\n${failures === 0 ? '=== ALL CONFIRM BOOKING VERIFICATIONS PASSED ===' : `=== ${failures} CHECK(S) FAILED ===`}`)
  process.exit(failures === 0 ? 0 : 1)
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1) })
