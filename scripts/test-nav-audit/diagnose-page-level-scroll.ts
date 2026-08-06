import { chromium } from 'playwright'
import { config } from 'dotenv'
config({ path: '.env.local' })

const BASE = 'http://127.0.0.1:3000'

async function testWidth(width: number, height: number, label: string) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage({ viewport: { width, height } })
  page.setDefaultTimeout(90000)

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@devtest.local')
  await page.fill('input[type="password"]', 'DevTest123!')
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/login') && r.request().method() === 'POST'),
    page.click('button[type="submit"]'),
  ])
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/office/leads`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const info = await page.evaluate(() => {
    const html = document.documentElement
    const body = document.body
    const header = document.querySelector('header') as HTMLElement | null
    const nav = document.querySelector('nav') as HTMLElement | null
    const board = document.querySelector('.overflow-x-auto') as HTMLElement

    return {
      windowInnerWidth: window.innerWidth,
      htmlScrollWidth: html.scrollWidth,
      htmlClientWidth: html.clientWidth,
      htmlOverflowX: getComputedStyle(html).overflowX,
      bodyScrollWidth: body.scrollWidth,
      bodyClientWidth: body.clientWidth,
      bodyOverflowX: getComputedStyle(body).overflowX,
      pageHasHorizontalOverflow: html.scrollWidth > html.clientWidth,
      headerScrollWidth: header ? header.scrollWidth : null,
      headerClientWidth: header ? header.clientWidth : null,
      navScrollWidth: nav ? nav.scrollWidth : null,
      navClientWidth: nav ? nav.clientWidth : null,
      boardScrollWidth: board.scrollWidth,
      boardClientWidth: board.clientWidth,
    }
  })
  console.log(`\n=== ${label} (${width}x${height}) ===`)
  console.log(JSON.stringify(info, null, 2))

  await browser.close()
}

async function main() {
  await testWidth(1536, 824, 'Real machine maximized')
  await testWidth(1366, 728, 'Smaller laptop')
  await testWidth(1280, 800, 'Narrower — likely to expose nav overflow if any')
}
main().catch((err) => { console.error('FATAL:', err); process.exit(1) })
