import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.setDefaultTimeout(90000)

  const consoleMsgs: string[] = []
  page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`))
  page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${err.message}`))

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  const [loginResp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  console.log('Login POST status:', loginResp.status())
  await page.waitForTimeout(2000)

  const navResp = await page.goto(`${BASE}/office/leads`, { waitUntil: 'domcontentloaded' })
  console.log('Nav response status:', navResp?.status(), 'final url:', page.url())
  await page.waitForTimeout(2500)
  console.log('URL after settle:', page.url())
  const h1 = await page.locator('h1').first().textContent().catch(() => '(none)')
  console.log('h1:', h1)

  console.log('=== Console/page errors since load ===')
  consoleMsgs.forEach((m) => console.log(m))
  if (consoleMsgs.length === 0) console.log('(none)')

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-before-scroll.png', fullPage: false })

  // Inspect the actual scroll container(s)
  const info = await page.evaluate(() => {
    // Find candidate scroll containers: the flex board row, its parents up to body
    const results: any[] = []
    const boardRow = document.querySelector('.overflow-x-auto')
    let el: Element | null = boardRow
    let depth = 0
    while (el && depth < 8) {
      const cs = getComputedStyle(el)
      const rect = el.getBoundingClientRect()
      results.push({
        tag: el.tagName,
        className: (el as HTMLElement).className,
        scrollWidth: (el as HTMLElement).scrollWidth,
        clientWidth: (el as HTMLElement).clientWidth,
        scrollLeft: (el as HTMLElement).scrollLeft,
        overflowX: cs.overflowX,
        overflowY: cs.overflowY,
        height: cs.height,
        rectWidth: rect.width,
        rectHeight: rect.height,
        maxWidth: cs.maxWidth,
        display: cs.display,
        flex: cs.flex,
      })
      el = el.parentElement
      depth++
    }
    return results
  })

  console.log('\n=== Ancestor chain from .overflow-x-auto up to body (scroll diagnostics) ===')
  console.log(JSON.stringify(info, null, 2))

  // Try scrolling the board container fully to the right and see what happens
  const scrollResult = await page.evaluate(() => {
    const el = document.querySelector('.overflow-x-auto') as HTMLElement | null
    if (!el) return { error: 'no .overflow-x-auto element found' }
    const before = el.scrollLeft
    el.scrollLeft = 999999
    const after = el.scrollLeft
    return { before, after, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, maxPossibleScroll: el.scrollWidth - el.clientWidth }
  })
  console.log('\n=== Programmatic scrollLeft = 999999 result ===')
  console.log(JSON.stringify(scrollResult, null, 2))

  await page.screenshot({ path: 'D:/CRM/scripts/test-nav-audit/leads-after-scroll.png', fullPage: false })

  // Count columns actually rendered
  const columnCount = await page.evaluate(() => document.querySelectorAll('.overflow-x-auto > div').length)
  console.log('\nRendered column count:', columnCount)

  await browser.close()
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
