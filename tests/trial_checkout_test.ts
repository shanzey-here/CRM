import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { spawn, ChildProcess } from 'child_process'
import crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  console.log('--- Real Stripe Checkout Reactivation Loop Test ---')
  const tenantId = crypto.randomUUID()
  
  // 1. Provision suspended tenant
  console.log(`\n[1] Provisioning suspended tenant: ${tenantId}`)
  await supabase.from('tenants').insert([{ id: tenantId, name: 'Reactivate Test', slug: `reactivate-${tenantId}` }])
  const { error: tsErr } = await supabase.from('tenant_subscriptions').upsert([{
    tenant_id: tenantId,
    status: 'suspended',
    current_period_end: new Date().toISOString()
  }], { onConflict: 'tenant_id' })
  if (tsErr) throw new Error('tsErr: ' + tsErr.message)

  const { data: beforeState } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
  console.log('BEFORE STATE:', beforeState)

  // 2. Start Stripe Listen and extract secret
  console.log('\n[2] Setting up real webhook pipeline...')
  
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
  console.log(`Stripe listener ready. Secret: ${webhookSecret.substring(0, 10)}...`)

  // 3. Start Next.js with the extracted secret
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
  console.log('Next.js server ready.')
  await sleep(2000) // Give Next.js a moment to settle

  // 4. Trigger a real Stripe event
  console.log(`\n[4] Triggering real customer.subscription.created for tenant ${tenantId}...`)
  
  const triggerProc = spawn('stripe', [
    'trigger', 'customer.subscription.created', 
    '--add', `subscription:metadata.tenant_id=${tenantId}`
  ], { shell: true })

  triggerProc.stdout.on('data', (data) => console.log('Trigger:', data.toString().trim()))
  
  // 5. Poll DB to observe reactivation
  console.log('\n[5] Polling DB for reactivation...')
  let reactivated = false
  let afterState = null

  for (let i = 0; i < 20; i++) {
    await sleep(2000)
    const { data: current } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
    if (current?.status === 'active') {
      reactivated = true
      afterState = current
      break
    }
  }

  console.log('\n[6] Test Results')
  if (reactivated) {
    console.log('✅ PASS: Tenant successfully reactivated to "active" status via real Stripe webhook.')
    console.log('AFTER STATE:', afterState)
  } else {
    console.log('❌ FAIL: Tenant status did not change to "active" within 40 seconds.')
    const { data: finalState } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
    console.log('FINAL STATE:', finalState)
  }

  // Cleanup
  nextProc.kill()
  listenProc.kill()
  await supabase.from('tenant_subscriptions').delete().eq('tenant_id', tenantId)
  await supabase.from('tenants').delete().eq('id', tenantId)

  if (!reactivated) {
    process.exit(1)
  }
}

run().catch(console.error)
