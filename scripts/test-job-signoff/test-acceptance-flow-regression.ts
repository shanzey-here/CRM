import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const TOKEN = process.argv[2]
const QUOTE_ID = process.argv[3]

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)

  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()))
  page.on('pageerror', (err) => console.log('BROWSER PAGE EXCEPTION:', err.message))

  await page.goto(`http://localhost:3000/proposal/${TOKEN}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=Review & Sign', { timeout: 30000 })
  console.log('✓ Proposal page loaded, shared SignatureCapture component rendered')

  await page.waitForTimeout(2000)

  await page.fill('input[placeholder="John Doe"]', 'Regression Test Customer')
  const inputValue = await page.inputValue('input[placeholder="John Doe"]')
  console.log('DIAGNOSTIC: name input value after fill:', inputValue)

  const canvasCount = await page.locator('canvas').count()
  const buttonTexts = await page.locator('button').allTextContents()
  console.log('DIAGNOSTIC: canvas count:', canvasCount, '| all button texts:', JSON.stringify(buttonTexts))

  const canvas = page.locator('canvas')
  const box = await canvas.boundingBox()
  console.log('DIAGNOSTIC: canvas bounding box:', JSON.stringify(box))

  // Same dragTo() approach proven reliable across every job-signoff.tsx
  // test this session — signature_pad tracks its own internal stroke
  // history (used by isEmpty()) independently of raw canvas pixels, and
  // dragTo() is what actually registers a stroke correctly.
  await canvas.dragTo(canvas, { sourcePosition: { x: 10, y: 10 }, targetPosition: { x: 150, y: 60 } })
  await page.click('button:has-text("Accept Quote")')
  await page.waitForTimeout(2000)
  const buttonTextsAfter = await page.locator('button').allTextContents()
  console.log('DIAGNOSTIC: button texts 2s after click (Processing... would confirm submit fired):', JSON.stringify(buttonTextsAfter))
  console.log('DIAGNOSTIC: current URL after click (must stay on proposal page, not a fresh navigation):', page.url())
  const bodyAfterClick = await page.textContent('body')
  console.log('DIAGNOSTIC: "Please type your full name" error shown:', bodyAfterClick?.includes('Please type your full name'))
  console.log('DIAGNOSTIC: "Please draw your signature" error shown:', bodyAfterClick?.includes('Please draw your signature'))
  await page.screenshot({ path: 'scripts/test-job-signoff/acceptance-flow-after-submit.png', fullPage: true })

  await page.waitForSelector('text=Quote Accepted!', { timeout: 90000 })
  console.log('✓ UI shows "Quote Accepted!" (zero-deposit bypass path)')

  const { data: quote } = await supabase.from('quotes').select('status, accepted_at').eq('id', QUOTE_ID).single()
  console.log('\nReal quote row after acceptance:', JSON.stringify(quote))
  console.log('Status transitioned to accepted (real DB):', quote?.status === 'accepted')

  const { data: signatures } = await supabase.from('quote_signatures').select('*').eq('quote_id', QUOTE_ID).order('created_at', { ascending: false }).limit(1)
  const sig = signatures?.[0]
  console.log('\nReal quote_signatures row (via the shared SignatureCapture component):', JSON.stringify(sig, null, 2))
  console.log('Signature name recorded correctly:', sig?.signature_name === 'Regression Test Customer')
  console.log('Document hash recorded:', !!sig?.document_hash)
  console.log('Signature storage path recorded:', !!sig?.signature_storage_path)

  await browser.close()
  console.log('\n✅ Acceptance-flow regression test complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
