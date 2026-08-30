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

function assert(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) throw new Error(`Assertion failed: ${label} ${detail}`)
}

async function seedLead(tenantId: string, brandId: string, tag: string, stage = 'inquiry') {
  const { data: c } = await supabaseAdmin.from('contacts').insert({
    tenant_id: tenantId, first_name: 'FollowUp', last_name: tag, email: `followup.${tag}@example.com`,
    phone: '07700 900123',
  }).select('id').single()
  const { data: l } = await supabaseAdmin.from('leads').insert({
    tenant_id: tenantId, contact_id: c!.id, brand_id: brandId, stage, source: 'website',
    preferred_move_date: '2026-11-15',
  }).select('id').single()
  return { contactId: c!.id, leadId: l!.id }
}

async function cleanup(tag: string) {
  const { data: cs } = await supabaseAdmin.from('contacts').select('id').eq('email', `followup.${tag}@example.com`)
  for (const c of cs || []) {
    const { data: ls } = await supabaseAdmin.from('leads').select('id').eq('contact_id', c.id)
    for (const l of ls || []) {
      await supabaseAdmin.from('tasks').delete().eq('lead_id', l.id)
      await supabaseAdmin.from('activities').delete().eq('lead_id', l.id)
      await supabaseAdmin.from('leads').delete().eq('id', l.id)
    }
    await supabaseAdmin.from('contacts').delete().eq('id', c.id)
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

async function openFollowUpModal(page: any, leadId: string) {
  await page.goto(`${BASE}/office/leads/${leadId}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  // lead-detail quick-actions bar labels the button "Follow Up" (the Kanban
  // card uses "Log Follow-Up"); accept either.
  await page.waitForSelector('button[aria-label="Follow Up"], button[aria-label="Log Follow-Up"]', { timeout: 120000 })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(5000) // hydration
  await page.locator('button[aria-label="Follow Up"], button[aria-label="Log Follow-Up"]').first().click()
  await page.waitForSelector('text=What happened?', { timeout: 25000 })
}

async function run() {
  await cleanup('withreminder'); await cleanup('noreminder')

  const { data: user } = await supabaseAdmin.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = user!.tenant_id!
  const { data: brand } = await supabaseAdmin.from('brands').select('id').eq('tenant_id', tenantId).limit(1).single()

  const browser = await chromium.launch({ headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  page.on('pageerror', (e: any) => console.log('  [pageerror]', e.message))

  await login(page)

  // ========================================================================
  // TEST 1 — follow-up WITH a reminder date, on a lead in `inquiry`
  // ========================================================================
  console.log('\n=== TEST 1: follow-up with note + method + reminder date ===')
  const t1 = await seedLead(tenantId, brand!.id, 'withreminder', 'inquiry')
  await openFollowUpModal(page, t1.leadId)

  await page.fill('#follow-up-note', 'Called the customer, left a voicemail. Will retry Thursday.')
  await page.locator('[role="dialog"] button[role="combobox"]').first().click()
  await page.getByRole('option', { name: 'Phone call' }).click()
  // Near-term date so it sorts into the dashboard TasksWidget's top-5 (ordered
  // by due_date asc) — proving the reuse actually surfaces there.
  const reminder = '2026-08-25'
  await page.fill('#follow-up-reminder', reminder)
  await page.screenshot({ path: path.join(SHOTS, 'follow-up-form-filled.png') })

  await Promise.all([
    page.waitForResponse((r: any) => r.request().method() === 'POST' && r.url().includes(`/office/leads/${t1.leadId}`), { timeout: 20000 }).catch(() => null),
    page.click('button:has-text("Log Follow-Up")'),
  ])
  await page.waitForTimeout(4000)

  // --- DB assertions ---
  const { data: lead1 } = await supabaseAdmin.from('leads').select('stage').eq('id', t1.leadId).single()
  assert('lead stage -> follow_up', lead1?.stage === 'follow_up', `got ${lead1?.stage}`)

  const { data: acts1 } = await supabaseAdmin.from('activities')
    .select('type, content, metadata').eq('lead_id', t1.leadId).order('created_at', { ascending: true })
  const noteAct = (acts1 || []).find((a) => a.type === 'call')
  assert('note activity written (type=call for phone)', !!noteAct, JSON.stringify(noteAct))
  assert('note activity has the real note text', !!noteAct && /left a voicemail/i.test(noteAct.content))
  assert('note activity metadata records contact_method', !!noteAct && (noteAct.metadata as any)?.contact_method === 'phone')

  const stageActs = (acts1 || []).filter((a) => a.type === 'stage_change')
  assert('exactly ONE stage_change activity (from trigger, no duplicate)', stageActs.length === 1, `count=${stageActs.length}`)
  assert('stage_change activity says "... to follow_up"', /to follow_up$/.test(stageActs[0]?.content || ''), stageActs[0]?.content)

  const { data: tasks1 } = await supabaseAdmin.from('tasks')
    .select('title, status, due_date, lead_id').eq('lead_id', t1.leadId)
  assert('exactly one reminder task created', (tasks1 || []).length === 1, `count=${(tasks1 || []).length}`)
  assert('task status = pending', tasks1?.[0]?.status === 'pending')
  assert('task due_date is on the chosen day', (tasks1?.[0]?.due_date || '').startsWith(reminder), tasks1?.[0]?.due_date)

  // --- Screenshot: Activity Timeline on the lead detail page ---
  await page.goto(`${BASE}/office/leads/${t1.leadId}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('text=Activity Timeline', { timeout: 30000 })
  await page.waitForTimeout(1500)
  const timelineText = await page.locator('body').innerText()
  assert('timeline shows the follow-up note', /voicemail/i.test(timelineText), timelineText.slice(0, 120))
  assert('timeline shows the stage move to follow_up', /Moved from .*follow_up/i.test(timelineText))
  await page.screenshot({ path: path.join(SHOTS, 'follow-up-timeline.png'), fullPage: true })

  // --- Screenshot: Dashboard TasksWidget shows the reminder ---
  await page.goto(`${BASE}/office`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  // Widgets are Suspense-streamed — wait for the actual task row to render.
  const dashTask = page.locator('text=Follow up with FollowUp withreminder').first()
  await dashTask.waitFor({ state: 'visible', timeout: 45000 })
  await dashTask.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  assert('dashboard TasksWidget shows the reminder task', true)
  await page.screenshot({ path: path.join(SHOTS, 'follow-up-dashboard-task.png'), fullPage: true })

  // ========================================================================
  // TEST 2 — follow-up with NO reminder date, on a lead in `survey_scheduled`
  // (proves it's available regardless of current stage, and no task is made)
  // ========================================================================
  console.log('\n=== TEST 2: follow-up with no reminder date, lead in survey_scheduled ===')
  const t2 = await seedLead(tenantId, brand!.id, 'noreminder', 'survey_scheduled')
  await openFollowUpModal(page, t2.leadId)
  await page.fill('#follow-up-note', 'Emailed updated quote. No callback needed for now.')
  await page.locator('[role="dialog"] button[role="combobox"]').first().click()
  await page.getByRole('option', { name: 'Email', exact: true }).click()
  await Promise.all([
    page.waitForResponse((r: any) => r.request().method() === 'POST' && r.url().includes(`/office/leads/${t2.leadId}`), { timeout: 20000 }).catch(() => null),
    page.click('button:has-text("Log Follow-Up")'),
  ])
  await page.waitForTimeout(4000)

  const { data: lead2 } = await supabaseAdmin.from('leads').select('stage').eq('id', t2.leadId).single()
  assert('lead stage -> follow_up (from survey_scheduled)', lead2?.stage === 'follow_up', `got ${lead2?.stage}`)
  const { data: acts2 } = await supabaseAdmin.from('activities').select('type, content').eq('lead_id', t2.leadId)
  assert('email-type note activity written', (acts2 || []).some((a) => a.type === 'email' && /updated quote/i.test(a.content)))
  assert('exactly one stage_change activity', (acts2 || []).filter((a) => a.type === 'stage_change').length === 1)
  const { data: tasks2 } = await supabaseAdmin.from('tasks').select('id').eq('lead_id', t2.leadId)
  assert('NO task row created when no reminder date', (tasks2 || []).length === 0, `count=${(tasks2 || []).length}`)

  // ========================================================================
  // TEST 3 — regression: the other quick-action modals still open
  // ========================================================================
  console.log('\n=== TEST 3: regression — sibling quick actions still work ===')
  await page.goto(`${BASE}/office/leads/${t2.leadId}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('button[aria-label="Schedule Survey"]', { timeout: 60000 })
  await page.waitForTimeout(4000)
  await page.locator('button[aria-label="Schedule Survey"]').first().click()
  await page.waitForSelector('text=Schedule Survey Appointment', { timeout: 15000 })
  assert('Schedule Survey modal still opens', true)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  await page.locator('button[aria-label="Send Quote"]').first().click()
  await page.waitForSelector('text=Real Process Trigger', { timeout: 15000 })
  assert('Send Quote modal still opens', true)

  await browser.close()

  // ========================================================================
  // TEST 4 — getLeadsNeedingFollowUp untouched
  // ========================================================================
  const { execSync } = require('child_process')
  const diff = execSync('git diff --stat HEAD -- src/modules/leads/server/repository.ts', { encoding: 'utf8' })
  console.log('\n=== TEST 4: getLeadsNeedingFollowUp / repository.ts diff ===')
  console.log(diff.trim() || '(no changes)')
  assert('src/modules/leads/server/repository.ts NOT modified by this branch', diff.trim() === '')

  await cleanup('withreminder'); await cleanup('noreminder')
  console.log('\n=== ALL FOLLOW-UP ACTION VERIFICATIONS PASSED ===')
}

run().catch((e) => { console.error('FAILED:', e); process.exit(1) })
