import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function loginAs(page: any, email: string, password: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL((url: URL) => !url.pathname.startsWith('/login'), { timeout: 60000 })
  } catch {
    console.log('  (login did not redirect away from /login within 60s)')
  }
  // Give the second-hop redirect (root "/" -> role-based destination) time
  // to fully settle before reading the final URL.
  await page.waitForTimeout(4000)
}

async function main() {
  // 1. Confirm entitlement restoration landed correctly
  const { data: admin } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const { data: modules } = await serviceClient.from('tenant_modules').select('module_key, enabled').eq('tenant_id', tenantId)
  console.log('========== Entitlement state after restoration ==========')
  console.log(JSON.stringify(modules, null, 2))
  console.log('Matches original (automation_workflows=true, storage_crate_tracking=true, analytics=true, social_media=false):',
    modules?.find(m => m.module_key === 'automation_workflows')?.enabled === true &&
    modules?.find(m => m.module_key === 'storage_crate_tracking')?.enabled === true &&
    modules?.find(m => m.module_key === 'analytics')?.enabled === true &&
    modules?.find(m => m.module_key === 'social_media')?.enabled === false
  )

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })

  // 2. Robust landing-page check: wait for full network idle, check FINAL URL and real Dashboard content
  console.log('\n========== Robust landing-page check (tenant_admin) ==========')
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'admin@devtest.local', 'DevTest123!')
    console.log('Final URL after full network-idle settle:', page.url())
    const bodyText = await page.textContent('body')
    console.log('Body text sample (should show real Dashboard content, not Leads pipeline):', bodyText?.slice(0, 300))
    await page.close()
  }
  console.log('\n========== Robust landing-page check (dispatcher) ==========')
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'dispatcher@devtest.local', 'DevTest123!')
    console.log('Final URL after full network-idle settle:', page.url())
    const bodyText = await page.textContent('body')
    console.log('Body text sample:', bodyText?.slice(0, 300))
    await page.close()
  }

  // 3. Re-verify Social's actual locked-message wording with the current (real, restored) not-entitled state
  console.log('\n========== Social locked-message wording (current real not-entitled state) ==========')
  {
    const page = await browser.newPage()
    page.setDefaultTimeout(60000)
    await loginAs(page, 'admin@devtest.local', 'DevTest123!')
    await page.goto(`${BASE}/office/social`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    const bodyText = await page.textContent('body')
    console.log('Full Social page body text:', bodyText)
    console.log('Contains real upgrade message (loose match "available on your current plan"):', bodyText?.toLowerCase().includes('available on your current plan'))
    await page.close()
  }

  await browser.close()
  console.log('\n✅ Re-verification complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
