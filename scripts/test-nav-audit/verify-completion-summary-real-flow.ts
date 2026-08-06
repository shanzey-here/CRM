import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const JOB_ID = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  page.setDefaultTimeout(90000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().includes('/crew/jobs')) {
      const body = await res.text().catch(() => '')
      netLog.push(`status=${res.status()} body=${body.slice(0, 300)}`)
    }
  })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'crew@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  await page.goto(`${BASE}/crew/jobs/${JOB_ID}`, { waitUntil: 'domcontentloaded' })
  console.log('Waiting for "Job Sign-off" heading to actually render (client-side data load)...')
  await page.locator('text=Job Sign-off').waitFor({ state: 'visible', timeout: 60000 })

  console.log('URL:', page.url())
  const preSignBody = await page.locator('body').textContent()
  console.log('Has "Job Sign-off":', preSignBody?.includes('Job Sign-off'))

  await page.fill('input[placeholder="John Doe"]', 'Real Customer Signature Test')

  const canvas = page.locator('canvas').first()
  await canvas.dragTo(canvas, {
    sourcePosition: { x: 20, y: 20 },
    targetPosition: { x: 150, y: 100 },
  })
  await page.waitForTimeout(500)

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/before-signoff-submit.png' })
  const nameFieldValue = await page.locator('input[placeholder="John Doe"]').inputValue()
  console.log('Name field value right before submit:', nameFieldValue)

  await page.click('button:has-text("Sign & Complete Job")')
  await page.waitForTimeout(1000)
  const errorText = await page.locator('.bg-red-50').textContent().catch(() => null)
  console.log('Validation error shown right after click:', errorText)

  console.log('\n=== Reloading to trigger the mount-time sync check (realistic: app reopened) ===')
  netLog.length = 0
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(20000)

  console.log('Network during sync:', JSON.stringify(netLog, null, 2))

  const postSignBody = await page.locator('body').textContent()
  console.log('\nShows "Job Completed":', postSignBody?.includes('Job Completed'))
  console.log('Shows "pending sync":', postSignBody?.toLowerCase().includes('pending sync'))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/completion-signoff-result.png' })

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
