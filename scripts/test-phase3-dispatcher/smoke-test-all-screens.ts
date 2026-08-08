import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'
const SHOT_DIR = 'D:/CRM/scripts/test-phase3-dispatcher/final'

const SCREENS: { path: string; name: string }[] = [
  { path: '/office', name: 'dashboard' },
  { path: '/office/leads', name: 'leads-kanban' },
  { path: '/office/clients', name: 'clients' },
  { path: '/office/scheduling', name: 'scheduling' },
  { path: '/office/tasks', name: 'tasks' },
  { path: '/office/jobs', name: 'jobs' },
  { path: '/office/email', name: 'email-inbox' },
  { path: '/office/email/review-queue', name: 'email-review-queue' },
  { path: '/office/email/auto-sent-log', name: 'email-auto-sent-log' },
  { path: '/office/social', name: 'social' },
  { path: '/office/storage', name: 'storage' },
  { path: '/office/storage/units', name: 'storage-units' },
  { path: '/office/reports', name: 'reports' },
  { path: '/office/settings', name: 'settings' },
  { path: '/office/settings/inventory', name: 'settings-inventory' },
  { path: '/office/settings/branding', name: 'settings-branding' },
  { path: '/office/settings/pricing', name: 'settings-pricing' },
  { path: '/office/settings/staff', name: 'settings-staff' },
  { path: '/office/settings/billing', name: 'settings-billing' },
  { path: '/office/settings/mailboxes', name: 'settings-mailboxes' },
  { path: '/office/settings/ai-assistant', name: 'settings-ai-assistant' },
]

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  page.setDefaultTimeout(60000)

  const results: Record<string, { errors: string[] }> = {}
  let currentScreen = ''
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('hydrated but some attributes')) {
      results[currentScreen] = results[currentScreen] || { errors: [] }
      results[currentScreen].errors.push(m.text().slice(0, 200))
    }
  })
  page.on('pageerror', (e) => {
    results[currentScreen] = results[currentScreen] || { errors: [] }
    results[currentScreen].errors.push('PAGEERROR: ' + e.message.slice(0, 200))
  })

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)

  for (const screen of SCREENS) {
    currentScreen = screen.name
    try {
      await page.goto(`${BASE}${screen.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await page.waitForTimeout(2500)
      await page.screenshot({ path: `${SHOT_DIR}/${screen.name}.png`, fullPage: true })
      console.log(`[OK] ${screen.name} (${screen.path})`)
    } catch (e: any) {
      console.log(`[NAV ERROR] ${screen.name}: ${e.message.slice(0, 150)}`)
    }
  }

  console.log('\n=== Console errors per screen ===')
  for (const [name, r] of Object.entries(results)) {
    console.log(`${name}: ${JSON.stringify(r.errors)}`)
  }
  console.log(screenSummary(results, SCREENS))

  function screenSummary(res: typeof results, screens: typeof SCREENS) {
    const clean = screens.filter(s => !res[s.name] || res[s.name].errors.length === 0).map(s => s.name)
    return `\nClean screens (no console errors): ${clean.length}/${screens.length}\n${clean.join(', ')}`
  }

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
