import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots')
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function captureScreenshots() {
  const { data: userRow } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('email', 'admin@devtest.local')
    .single()

  const tenantId = userRow!.tenant_id!

  // Create test stage with 1 lead in it for the delete warning dialog
  const { data: testStage } = await supabase
    .from('pipeline_stages')
    .insert({
      tenant_id: tenantId,
      name: 'Appraisal Queue',
      color: '#8b5cf6',
      position: 2,
      is_system: false,
      is_hidden_by_default: false,
    })
    .select()
    .single()

  const stageId = testStage!.id

  const { data: testLead } = await supabase
    .from('leads')
    .select('id, stage_id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single()

  const origStageId = testLead?.stage_id
  if (testLead) {
    await supabase.from('leads').update({ stage_id: stageId }).eq('id', testLead.id)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const baseUrl = 'http://127.0.0.1:3000'

  try {
    // Log in
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[name="email"]', 'admin@devtest.local')
    await page.fill('input[name="password"]', 'DevTest123!')
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/login') && res.status() === 303, { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]')
    ])
    await page.waitForTimeout(2000)

    // Navigate to /office/leads
    await page.goto(`${baseUrl}/office/leads`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('text=Leads Pipeline', { timeout: 20000 })
    await page.waitForTimeout(1000)

    // 1. Screenshot of column options menu open
    const menuBtn = page.locator(`[data-testid="column-menu-trigger-${stageId}"]`)
    await menuBtn.scrollIntoViewIfNeeded()
    await menuBtn.click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'kanban-column-options-menu.png') })
    console.log('✓ Captured kanban-column-options-menu.png')

    // 2. Click Rename / Edit and screenshot Edit Dialog
    const editItem = page.locator(`[data-testid="column-menu-edit-${stageId}"]`)
    await editItem.click()
    await page.waitForSelector('[data-testid="edit-column-dialog"]', { timeout: 5000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'modal-edit-column.png') })
    console.log('✓ Captured modal-edit-column.png')

    // Close edit modal
    await page.click('button:has-text("Cancel")')
    await page.waitForTimeout(400)

    // 3. Open menu and click Delete Column to screenshot Delete Warning with Fallback selector
    await menuBtn.click()
    await page.waitForTimeout(400)
    const deleteItem = page.locator(`[data-testid="column-menu-delete-${stageId}"]`)
    await deleteItem.click()
    await page.waitForSelector('[data-testid="delete-column-dialog"]', { timeout: 5000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'modal-delete-column-with-leads.png') })
    console.log('✓ Captured modal-delete-column-with-leads.png')

    await page.click('button:has-text("Cancel")')
    await page.waitForTimeout(400)

  } finally {
    if (testLead && origStageId) {
      await supabase.from('leads').update({ stage_id: origStageId }).eq('id', testLead.id)
    }
    await supabase.from('pipeline_stages').delete().eq('id', stageId)
    await browser.close()
  }
}

captureScreenshots().catch(console.error)
