import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'

async function testWidth(width: number, height: number) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width, height } })
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
  await page.waitForTimeout(2000)
  const info = await page.evaluate(() => {
    const html = document.documentElement
    const nav = document.querySelector('nav') as HTMLElement | null
    return {
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      overflow: html.scrollWidth - html.clientWidth,
      navScrollWidth: nav ? nav.scrollWidth : null,
    }
  })
  console.log(`width=${width}:`, JSON.stringify(info))
  await browser.close()
}
async function main() {
  for (const w of [1536, 1519, 1400, 1350, 1330, 1310, 1300, 1290, 1280]) {
    await testWidth(w, 824)
  }
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
