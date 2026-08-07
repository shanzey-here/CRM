import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const INVOICE_ID = '51041c88-7b87-4f98-9a20-5d7c037f4de2'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  page.setDefaultTimeout(60000)
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()))
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)

  await page.goto(`${BASE}/office/invoices/${INVOICE_ID}`, { waitUntil: 'networkidle' })
  await page.locator('text=Edit Invoice').waitFor({ state: 'visible', timeout: 30000 })
  console.log('Loaded invoice detail page, Edit Invoice button visible:', true)
  // Give client-component chunk time to finish compiling/hydrating (dev-mode on-demand entries)
  await page.waitForTimeout(5000)

  await page.getByRole('button', { name: 'Edit Invoice' }).click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/debug-after-click-edit.png', fullPage: true })
  const fullBody = await page.locator('body').textContent()
  console.log('Body contains "Edit Draft Invoice" text:', fullBody?.includes('Edit Draft Invoice'))
  const dialogCount = await page.locator('[data-slot="dialog-content"]').count()
  console.log('dialog-content element count:', dialogCount)
  if (dialogCount > 0) {
    const box = await page.locator('[data-slot="dialog-content"]').first().boundingBox()
    console.log('dialog-content bounding box:', JSON.stringify(box))
    const opacity = await page.locator('[data-slot="dialog-content"]').first().evaluate((el) => getComputedStyle(el).opacity)
    console.log('dialog-content computed opacity:', opacity)
  }
  await page.locator('[data-slot="dialog-content"]').first().waitFor({ state: 'attached', timeout: 15000 })

  // Edit the existing line item
  const descInput = page.locator('input[placeholder="Description"]').first()
  await descInput.fill('Removals Service (Updated via real test)')
  const qtyInput = page.locator('input[placeholder="Qty"]').first()
  await qtyInput.fill('2')
  const priceInput = page.locator('input[placeholder="Unit £"]').first()
  await priceInput.fill('150')

  // Add a second line item
  await page.click('text=Add Line Item')
  const descInput2 = page.locator('input[placeholder="Description"]').nth(1)
  await descInput2.fill('Packing Materials')
  const qtyInput2 = page.locator('input[placeholder="Qty"]').nth(1)
  await qtyInput2.fill('3')
  const priceInput2 = page.locator('input[placeholder="Unit £"]').nth(1)
  await priceInput2.fill('20')

  // Edit notes
  await page.fill('#notes', 'Real E2E test edit — confirming persistence.')

  const liveTotalText = await page.locator('text=Total').last().locator('..').textContent()
  console.log('Live total shown in dialog before save:', liveTotalText)

  await Promise.all([
    page.waitForTimeout(500),
    page.click('button:has-text("Save Changes")'),
  ])
  await page.waitForTimeout(2000)

  const errorBox = await page.locator('.bg-red-50').textContent().catch(() => null)
  console.log('Error shown after save (should be null):', errorBox)

  const dialogStillOpen = await page.locator('text=Edit Draft Invoice').isVisible().catch(() => false)
  console.log('Dialog still open after save (should be false):', dialogStillOpen)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const bodyText = await page.locator('body').textContent()
  console.log('Page contains updated description:', bodyText?.includes('Removals Service (Updated via real test)'))
  console.log('Page contains "Packing Materials":', bodyText?.includes('Packing Materials'))
  console.log('Page contains new total £360.00:', bodyText?.includes('360.00'))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/edit-invoice-after-save.png', fullPage: true })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
