import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const SHOT_DIR = 'D:/CRM/scripts/test-phase3-dispatcher/final'

const SCREENS = [
  '/office', '/office/leads', '/office/clients', '/office/scheduling', '/office/tasks',
  '/office/jobs', '/office/email', '/office/email/review-queue', '/office/email/auto-sent-log',
  '/office/social', '/office/storage', '/office/storage/units', '/office/reports',
  '/office/settings', '/office/settings/inventory', '/office/settings/branding',
  '/office/settings/pricing', '/office/settings/staff', '/office/settings/billing',
  '/office/settings/mailboxes', '/office/settings/ai-assistant',
]

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
    page.setDefaultTimeout(60000)
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
    await page.waitForTimeout(1500)

    const okScreens: string[] = []
    const failedScreens: string[] = []
    for (const p of SCREENS) {
      const name = p.replace(/\//g, '_') || 'root'
      currentScreen = name
      try {
        await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        await page.waitForTimeout(1200)
        await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: true })
        okScreens.push(p)
      } catch (e: any) {
        failedScreens.push(p)
        console.log(`[NAV ERROR] ${p}: ${e.message.slice(0, 100)}`)
      }
    }
    console.log('\nOK:', okScreens.length, '/', SCREENS.length)
    console.log('Failed:', JSON.stringify(failedScreens))
    console.log('Errors by screen:', JSON.stringify(errors))
  } finally {
    await browser.close()
  }
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
