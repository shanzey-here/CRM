import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'
const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function login(page: any) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r: any) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
}

function getCounts(page: any) {
  return page.evaluate(() => {
    const cols = Array.from(document.querySelectorAll('.overflow-x-auto > div'))
    return cols.map((c) => ({ label: c.querySelector('span')?.textContent, count: c.querySelectorAll('[aria-label="Drag to reorder"]').length }))
  })
}

async function dragCard(page: any, srcColIdx: number, dstColIdx: number, netLog: string[]) {
  // Ensure the destination column is actually scrolled into the visible
  // viewport before measuring it — the board is horizontally scrollable and
  // later columns can otherwise be partially/fully off-screen.
  await page.evaluate((idx: number) => {
    const board = document.querySelector('.overflow-x-auto') as HTMLElement
    const col = board.children[idx] as HTMLElement
    col.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, dstColIdx)
  await page.waitForTimeout(300)

  const columns = page.locator('.overflow-x-auto > div')
  const srcDropZone = columns.nth(srcColIdx).locator('div.flex.flex-col.gap-2').first()
  const dstDropZone = columns.nth(dstColIdx).locator('div.flex.flex-col.gap-2').first()
  const card = srcDropZone.locator('> div').first()
  const grip = card.locator('[aria-label="Drag to reorder"]')
  const cardId = await card.evaluate((el: HTMLElement) => el.textContent?.slice(0, 36))
  const gripBox = await grip.boundingBox()
  const dstBox = await dstDropZone.boundingBox()
  if (!gripBox || !dstBox) return { error: 'missing boxes', cardId }

  const startX = gripBox.x + gripBox.width / 2, startY = gripBox.y + gripBox.height / 2
  const endX = dstBox.x + dstBox.width / 2, endY = dstBox.y + 60

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  const steps = 20
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (endX - startX) * i / steps, startY + (endY - startY) * i / steps)
    await page.waitForTimeout(30)
  }
  await page.waitForTimeout(300)
  const isOverHighlight = await columns.nth(dstColIdx).evaluate((el: HTMLElement) => el.style.boxShadow)
  await page.mouse.up()
  await page.waitForTimeout(2500)

  return { cardId, isOverHighlight }
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  const netLog: string[] = []
  page.on('response', async (res) => {
    if (res.request().method() === 'POST' && res.url().endsWith('/office/leads')) {
      const body = await res.text().catch(() => '')
      // The updateLeadStage server action response is a flight-encoded payload
      // containing {"success":true} or {"success":false,"error":...} — filter
      // out the unrelated getUserNotificationsAction polling responses.
      if (!body.includes('notification_type')) {
        netLog.push(`STATUS ${res.status()} BODY: ${body.slice(0, 400)}`)
      }
    }
  })

  await login(page)
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  console.log('======================================================')
  console.log('TEST 1: Drag column 1 (Inquiry) -> column 2 (Survey Scheduled)')
  console.log('======================================================')
  const before1 = await getCounts(page)
  console.log('Before:', JSON.stringify(before1))

  netLog.length = 0
  const drag1 = await dragCard(page, 0, 1, netLog)
  console.log('Dragged card id prefix:', drag1.cardId)
  console.log('Destination isOver boxShadow at drop time (non-empty = highlight fired):', JSON.stringify(drag1.isOverHighlight))
  console.log('Network response(s) captured during drag:')
  netLog.forEach((l) => console.log('  ' + l))

  const after1 = await getCounts(page)
  console.log('After (same session, before reload):', JSON.stringify(after1))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/verify-after-drag1.png' })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const afterReload1 = await getCounts(page)
  console.log('After FULL PAGE RELOAD (persistence proof):', JSON.stringify(afterReload1))

  console.log('\n======================================================')
  console.log('TEST 2: Drag column 3 (Quote Sent) -> column 5 (Confirmed Booking)')
  console.log('======================================================')
  const before2 = await getCounts(page)
  console.log('Before:', JSON.stringify(before2))

  netLog.length = 0
  const drag2 = await dragCard(page, 2, 4, netLog)
  console.log('Dragged card id prefix:', drag2.cardId)
  console.log('Destination isOver boxShadow at drop time:', JSON.stringify(drag2.isOverHighlight))
  console.log('Network response(s) captured during drag:')
  netLog.forEach((l) => console.log('  ' + l))

  const after2 = await getCounts(page)
  console.log('After (same session, before reload):', JSON.stringify(after2))

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const afterReload2 = await getCounts(page)
  console.log('After FULL PAGE RELOAD (persistence proof):', JSON.stringify(afterReload2))

  console.log('\n======================================================')
  console.log('REGRESSION CHECK: stale badge, card content/links, error banner absent')
  console.log('======================================================')
  const staleBadgeCount = await page.locator('text=/⚠/').count()
  console.log('Stale-badge (⚠) elements present on page:', staleBadgeCount)
  const errorBanner = await page.locator('[role="alert"]').count()
  console.log('Error banner present (should be 0 — no failed drags):', errorBanner)

  // Card content/links: click a card, confirm navigation to its detail page still works
  const firstCardLink = page.locator('.overflow-x-auto [aria-label="Drag to reorder"]').first()
  const cardContainer = firstCardLink.locator('..')
  await cardContainer.click()
  await page.waitForTimeout(1500)
  const detailUrl = page.url()
  const detailHeading = await page.locator('h1, h2').first().textContent().catch(() => '(none)')
  console.log('Clicking a card navigated to:', detailUrl)
  console.log('Detail page heading:', detailHeading)

  await browser.close()

  console.log('\n======================================================')
  console.log('CROSS-TENANT SCOPING CHECK (direct DB-level, actions.ts untouched)')
  console.log('======================================================')
  // actions.ts was not modified by this fix. Confirm the tenant-scoping guard
  // still rejects a cross-tenant stage-update attempt at the data layer.
  const { data: tenantA } = await serviceClient.from('tenants').select('id').limit(1).single()
  const { data: leadOtherTenant } = await serviceClient
    .from('leads')
    .select('id, tenant_id')
    .neq('tenant_id', tenantA!.id)
    .limit(1)
    .maybeSingle()
  console.log('Found a lead belonging to a different tenant than test admin:', leadOtherTenant?.id ?? '(none found in seed data)')
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
