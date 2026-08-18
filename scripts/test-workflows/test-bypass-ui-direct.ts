import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })
const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(30000)

  // Only step taken through any UI at all: log in, to obtain a REAL, valid session.
  // No navigation to /office/workflows, no form, no button — the save request below
  // is constructed and fired entirely by script, exactly as an attacker scripting a
  // raw request against the known Server Action endpoint would do.
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin-freetier@workflowtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(1500)

  console.log('Logged in as free-tier tenant_admin (admin-freetier@workflowtest.local). Now firing a raw, scripted POST directly at the saveWorkflow Server Action endpoint — no UI, no form, no button.')

  const response = await context.request.post(`${BASE}/office/workflows/new`, {
    headers: {
      'next-action': '60008845517d4c535d7ecff32211ad3f67b009e45b',
      'content-type': 'text/plain;charset=UTF-8',
      'accept': 'text/x-component',
    },
    data: JSON.stringify([
      {
        name: 'DIRECT BYPASS ATTACK — should be rejected server-side',
        is_active: true,
        trigger_event_type: 'lead.created',
        trigger_conditions: [],
        actions: [{ action_type: 'create_task', action_config: { title: 'Attack task' } }],
      },
      '$undefined',
    ]),
  })

  console.log('\nResponse status:', response.status())
  const body = await response.text()
  console.log('Response body:', body.slice(0, 2000))

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
