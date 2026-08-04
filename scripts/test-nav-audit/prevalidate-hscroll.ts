import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.addStyleTag({ content: `.overflow-x-auto > div > div:nth-child(2) { overflow-y: auto !important; max-height: 100%; }` })
  await page.waitForTimeout(300)
  const result = await page.evaluate(() => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const before = board.scrollLeft
    board.scrollLeft = 999999
    const after = board.scrollLeft
    return { before, after, scrollWidth: board.scrollWidth, clientWidth: board.clientWidth }
  })
  console.log('Horizontal board scroll WITH column overflow-y-auto applied:', JSON.stringify(result))
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
