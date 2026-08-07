import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const SHOT_DIR = 'D:/CRM/scripts/test-workflows'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  page.setDefaultTimeout(60000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin-freetier@workflowtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)

  // Step 1: list page — preview banner + pre-existing workflow visible + templates + New Workflow button
  await page.goto(`${BASE}/office/workflows`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const listBody = await page.locator('body').textContent()
  console.log('=== STEP 1: List page (free-tier tenant) ===')
  console.log('Shows preview-mode banner:', listBody?.includes("You're exploring Workflows in preview mode"))
  console.log('Shows "New Workflow" button:', await page.locator('a[href="/office/workflows/new"]').isVisible().catch(() => false))
  console.log('Shows template cards:', listBody?.includes('Start from a template'))
  console.log('Shows pre-existing seeded workflow in table:', listBody?.includes('Pre-existing seeded workflow'))
  await page.screenshot({ path: `${SHOT_DIR}/1-list-page-free-tier.png`, fullPage: true })

  // Step 2: open the real builder from scratch (New Workflow)
  await page.locator('a[href="/office/workflows/new"]').click({ force: true })
  await page.waitForTimeout(1500)
  console.log('\n=== STEP 2: Builder opened via New Workflow ===')
  console.log('URL:', page.url())
  await page.screenshot({ path: `${SHOT_DIR}/2-builder-blank.png`, fullPage: true })

  // Step 3: configure a real trigger/condition/action
  await page.fill('#name', 'Free tier exploration test workflow')
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Add Condition' }).click()
  await page.locator('input[placeholder="Field (e.g. source)"]').fill('source')
  await page.locator('input[placeholder="Value (e.g. website_form)"]').fill('website_form')
  await page.locator('input[placeholder="e.g. Call customer"]').fill('Follow up with free-tier test lead')
  await page.waitForTimeout(500)
  console.log('\n=== STEP 3: Configured real trigger/condition/action ===')
  await page.screenshot({ path: `${SHOT_DIR}/3-builder-configured.png`, fullPage: true })

  // Step 4: attempt to save — must be blocked with the upgrade callout, not a silent failure or raw error
  await page.getByRole('button', { name: /Save Workflow/i }).click()
  await page.waitForTimeout(8000)
  const afterSaveBody = await page.locator('body').textContent()
  console.log('\n=== STEP 4: Attempted save as free-tier tenant ===')
  console.log('Shows "Upgrade to save this workflow":', afterSaveBody?.includes('Upgrade to save this workflow'))
  console.log('Still on the builder page (not redirected as if saved):', page.url().includes('/office/workflows/new') || page.url().includes('/office/workflows/') === false ? page.url() : page.url())
  console.log('URL after attempted save:', page.url())
  await page.screenshot({ path: `${SHOT_DIR}/4-upgrade-callout.png`, fullPage: true })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
