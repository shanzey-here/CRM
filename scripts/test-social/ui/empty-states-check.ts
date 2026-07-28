import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: adminUser } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = adminUser!.tenant_id

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

  // --- State A: module disabled (plan-gate) ---
  await supabase.from('tenant_modules').update({ enabled: false }).eq('tenant_id', tenantId).eq('module_key', 'social_media')
  await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const notAvailableText = await page.locator('body').innerText()
  console.log('=== Module disabled: shows "not available on your plan"? ===', notAvailableText.includes("isn't available on your current plan"))
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/06-plan-gated.png', fullPage: true })
  await supabase.from('tenant_modules').update({ enabled: true }).eq('tenant_id', tenantId).eq('module_key', 'social_media')

  // --- State B: no connected accounts ---
  const { data: accounts } = await supabase.from('connected_social_accounts').select('id').eq('tenant_id', tenantId).eq('is_active', true)
  const accountIds = (accounts ?? []).map((a) => a.id)
  await supabase.from('connected_social_accounts').update({ is_active: false }).in('id', accountIds)
  await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  const noAccountsText = await page.locator('body').innerText()
  console.log('=== No accounts: shows "connect one to start posting"? ===', noAccountsText.includes('Connect one to start posting'))
  console.log('=== No accounts: composer form absent (no "Post content" label)? ===', !noAccountsText.includes('Post content'))
  await page.screenshot({ path: 'scripts/test-social/ui/screenshots/07-no-accounts.png', fullPage: true })
  await supabase.from('connected_social_accounts').update({ is_active: true }).in('id', accountIds)

  await browser.close()
  console.log('\nRestored: module re-enabled, accounts re-activated')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
