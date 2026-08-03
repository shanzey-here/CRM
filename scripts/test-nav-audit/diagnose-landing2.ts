import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  page.on('request', (req) => {
    console.log('>> REQUEST', req.method(), req.url())
  })
  page.on('response', (res) => {
    console.log('<< RESPONSE', res.status(), res.url(), res.headers()['location'] ? `Location: ${res.headers()['location']}` : '')
  })
  page.on('pageerror', (err) => console.log('PAGE EXCEPTION:', err.message))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  console.log('--- clicking submit ---')
  await page.click('button[type="submit"]')

  await page.waitForTimeout(15000)
  console.log('\nFINAL URL:', page.url())

  await browser.close()
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
