import { spawn } from 'child_process'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  console.log('--- Starting Infrastructure for Browser Test ---')
  
  const listenProc = spawn('stripe', ['listen', '--forward-to', 'http://localhost:3000/api/webhooks/stripe-subscriptions'], { shell: true })
  
  let listenReady = false
  let webhookSecret = ''

  listenProc.stdout.on('data', (data) => {
    const msg = data.toString()
    if (msg.includes('whsec_')) {
      const match = msg.match(/(whsec_[a-zA-Z0-9]+)/)
      if (match) webhookSecret = match[1]
    }
    if (msg.includes('Ready!')) listenReady = true
  })
  listenProc.stderr.on('data', (data) => {
    const msg = data.toString()
    console.log('Stripe Listen:', msg)
    if (msg.includes('whsec_')) {
      const match = msg.match(/(whsec_[a-zA-Z0-9]+)/)
      if (match) webhookSecret = match[1]
    }
    if (msg.includes('Ready!')) listenReady = true
  })

  let waitCount = 0
  while (!listenReady && waitCount < 10) {
    await sleep(1000)
    waitCount++
  }

  if (!listenReady || !webhookSecret) {
    console.error('Failed to start Stripe CLI listener or extract secret.')
    listenProc.kill()
    return
  }
  console.log(`Stripe listener ready. Secret: ${webhookSecret}`)

  console.log('\n[3] Starting Next.js server with webhook secret...')
  const nextProc = spawn('npm', ['run', 'dev'], { 
    shell: true,
    env: { ...process.env, STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET: webhookSecret }
  })

  let nextReady = false
  nextProc.stdout.on('data', (data) => {
    const msg = data.toString()
    console.log('[NEXTJS]', msg.trim())
    if (msg.includes('Ready in') || msg.includes('compiled in')) nextReady = true
  })
  nextProc.stderr.on('data', (data) => {
    const msg = data.toString()
    console.log('[NEXTJS ERR]', msg.trim())
    if (msg.includes('Ready in') || msg.includes('compiled in')) nextReady = true
  })

  waitCount = 0
  while (!nextReady && waitCount < 20) {
    await sleep(1000)
    waitCount++
  }

  if (!nextReady) {
    console.error('Failed to start Next.js.')
    nextProc.kill()
    listenProc.kill()
    return
  }
  
  console.log('\n=============================================')
  console.log('✅ NEXT.JS AND STRIPE LISTEN ARE RUNNING!')
  console.log('Keep this process alive while you run the browser test.')
  console.log('=============================================\n')
}

run().catch(console.error)
