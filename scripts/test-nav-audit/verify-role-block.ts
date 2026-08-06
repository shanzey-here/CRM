import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'

async function checkBlocked(email: string, label: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  page.setDefaultTimeout(60000)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  const jobsResp = await page.goto(`${BASE}/office/jobs/204844af-ad55-4d73-b91c-2188e0e587c6`, { waitUntil: 'domcontentloaded' })
  console.log(`${label}: /office/jobs/[id] -> final url=${page.url()} status=${jobsResp?.status()}`)

  const leadsResp = await page.goto(`${BASE}/office/leads/d292cd7a-576c-417c-8dee-9350bff59e67`, { waitUntil: 'domcontentloaded' })
  console.log(`${label}: /office/leads/[id] -> final url=${page.url()} status=${leadsResp?.status()}`)

  await browser.close()
}

async function main() {
  await checkBlocked('crew@devtest.local', 'crew')
  await checkBlocked('customer@devtest.local', 'customer')
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
