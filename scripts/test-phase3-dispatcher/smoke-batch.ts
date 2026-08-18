import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const SHOT_DIR = 'D:/CRM/scripts/test-phase3-dispatcher/final'

const paths = process.argv.slice(2)

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(150000)
  let currentScreen = ''
  const errors: Record<string, string[]> = {}
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('hydrated but some attributes')) {
      errors[currentScreen] = errors[currentScreen] || []
      errors[currentScreen].push(m.text().slice(0, 200))
    }
  })
  page.on('pageerror', (e) => {
    errors[currentScreen] = errors[currentScreen] || []
    errors[currentScreen].push('PAGEERROR: ' + e.message.slice(0, 200))
  })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  for (const p of paths) {
    const name = p.replace(/\//g, '_') || 'root'
    currentScreen = name
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 100000 })
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true })
      console.log(`[OK] ${p}`)
    } catch (e: any) {
      console.log(`[NAV ERROR] ${p}: ${e.message.slice(0, 150)}`)
    }
  }
  console.log('Errors:', JSON.stringify(errors))
  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
