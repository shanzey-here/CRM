import { chromium, devices } from 'playwright'
import { config } from 'dotenv'
import path from 'path'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const JOB_ID = '204844af-ad55-4d73-b91c-2188e0e587c6'
const SHOT_DIR = 'D:/CRM/scripts/test-crew-ui'

async function main() {
  const iPhone = devices['iPhone 13']
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({ ...iPhone })
  const page = await context.newPage()
  page.setDefaultTimeout(120000)
  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('hydrated')) consoleErrors.push(m.text().slice(0, 200)) })
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'crew@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  // Navigate to the job WHILE ONLINE first, so the run-sheet data itself caches successfully
  await page.goto(`${BASE}/crew/jobs/${JOB_ID}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(20000)
  console.log('Job loaded while online.')

  // NOW go offline (real browser-context-level offline emulation)
  await context.setOffline(true)
  console.log('Context set offline.')
  await page.waitForTimeout(500)

  // Trigger the browser's offline event manually since context.setOffline doesn't always fire it in all Chromium versions
  await page.evaluate(() => window.dispatchEvent(new Event('offline')))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOT_DIR}/5-offline-indicator.png`, fullPage: true })

  const bodyTextOffline = await page.locator('body').textContent()
  console.log('Offline banner visible:', bodyTextOffline?.includes('You are currently offline'))

  // Upload a real photo via the file input while offline
  await page.fill('input[placeholder="Caption (e.g. Before condition, Damage found)"]', 'Offline test photo')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.resolve('scripts/test-crew-ui/test-photo.png'))
  await page.waitForTimeout(2000)

  await page.screenshot({ path: `${SHOT_DIR}/6-photo-queued-offline.png`, fullPage: true })

  const bodyTextAfterQueue = await page.locator('body').textContent()
  console.log('Shows "Pending" photo badge:', bodyTextAfterQueue?.includes('Pending'))
  console.log('Shows "photo(s) pending upload":', bodyTextAfterQueue?.includes('pending upload'))

  // Go back online and confirm indicator disappears + last synced can update
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.waitForTimeout(15000)
  await page.screenshot({ path: `${SHOT_DIR}/7-after-back-online.png`, fullPage: true })
  const bodyTextOnline = await page.locator('body').textContent()
  console.log('Offline banner gone after reconnect:', !bodyTextOnline?.includes('You are currently offline'))

  console.log('\nConsole errors:', consoleErrors.length === 0 ? 'NONE' : JSON.stringify(consoleErrors))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
