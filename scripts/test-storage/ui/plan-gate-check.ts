import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)
  page.setDefaultNavigationTimeout(60000)

  await page.goto(`${BASE}/login`)
  await page.waitForSelector('#email')
  await page.fill('#email', 'admin@devtest.local')
  await page.fill('#password', 'DevTest123!')
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 })

  await supabase.from('tenant_modules').update({ enabled: false }).eq('tenant_id', tenantId).eq('module_key', 'storage_crate_tracking')
  await page.goto(`${BASE}/office/storage`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const bodyDisabled = await page.locator('body').innerText()
  console.log('Module disabled: shows "not available on your plan"?', bodyDisabled.includes('Not available on your current plan'))
  await page.screenshot({ path: 'scripts/test-storage/ui/screenshots/08-plan-gated.png', fullPage: true })

  await supabase.from('tenant_modules').update({ enabled: true }).eq('tenant_id', tenantId).eq('module_key', 'storage_crate_tracking')
  await page.goto(`${BASE}/office/storage`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const bodyEnabled = await page.locator('body').innerText()
  console.log('Module re-enabled: composer/list visible again?', bodyEnabled.includes('Crates') && !bodyEnabled.includes('Not available'))

  await browser.close()
  console.log('Restored: module re-enabled')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
