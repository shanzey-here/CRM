import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import crypto from 'crypto'
import { stripe } from '../src/modules/payments/server/stripe'
import { getOrCreateStripeCustomerId } from '../src/modules/subscriptions/server/stripe-billing'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  console.log('--- Real Stripe Subscription Webhook Integration Test ---')
  const tenantId = crypto.randomUUID()
  
  console.log(`\n[1] Provisioning suspended tenant: ${tenantId}`)
  await supabase.from('tenants').insert([{ id: tenantId, name: 'Real E2E Test', slug: `e2e-${tenantId}` }])
  await supabase.from('tenant_subscriptions').upsert([{
    tenant_id: tenantId,
    status: 'suspended',
    current_period_end: new Date().toISOString()
  }], { onConflict: 'tenant_id' })

  console.log('\n[2] Setting up real webhook pipeline (stripe listen + next dev)...')
  const listenProc = spawn('stripe', ['listen', '--api-key', process.env.STRIPE_SECRET_KEY!, '--forward-to', 'http://localhost:3000/api/webhooks/stripe-subscriptions'], { shell: true })
  
  let listenReady = false
  let webhookSecret = ''

  listenProc.stdout.on('data', (data) => {
    const msg = data.toString()
    console.log(`[Stripe CLI] ${msg.trim()}`)
    if (msg.includes('whsec_')) {
      const match = msg.match(/(whsec_[a-zA-Z0-9]+)/)
      if (match) webhookSecret = match[1]
    }
    if (msg.includes('Ready!')) listenReady = true
  })
  listenProc.stderr.on('data', (data) => {
    const msg = data.toString()
    console.error(`[Stripe CLI ERR] ${msg.trim()}`)
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
    console.error('Failed to start Stripe CLI listener.')
    process.exit(1)
  }

  const nextProc = spawn('npm', ['run', 'dev'], { 
    shell: true,
    env: { ...process.env, STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET: webhookSecret }
  })

  let nextReady = false
  nextProc.stdout.on('data', (data) => {
    const msg = data.toString()
    console.log(`[Next.js] ${msg.trim()}`)
    if (msg.includes('Ready in')) nextReady = true
  })
  nextProc.stderr.on('data', (data) => {
    const msg = data.toString()
    console.error(`[Next.js ERR] ${msg.trim()}`)
    if (msg.includes('Ready in')) nextReady = true
  })

  waitCount = 0
  while (!nextReady && waitCount < 20) {
    await sleep(1000)
    waitCount++
  }

  if (!nextReady) {
    console.error('Failed to start Next.js.')
    listenProc.kill()
    process.exit(1)
  }
  
  await sleep(2000)

  console.log('\n[3] Using actual app logic to get/create Stripe Customer ID...')
  const customerResult = await getOrCreateStripeCustomerId(supabase, tenantId)
  if ('error' in customerResult) throw new Error(customerResult.error)
  const customerId = customerResult.customerId
  console.log(`Stripe Customer ID mapped to tenant: ${customerId}`)

  console.log('\n[4] Creating temporary Stripe Product, Price, and attaching Payment Method...')
  const product = await stripe.products.create({ name: 'E2E Test Plan' })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000,
    currency: 'usd',
    recurring: { interval: 'month' }
  })

  // Attach a test payment method to the customer so the subscription activates immediately
  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId })
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: pm.id }
  })

  console.log('\n[5] Simulating Checkout Completion by creating a real Subscription in Stripe...')
  // When you create a subscription in Stripe directly, it fires the EXACT same 
  // 'customer.subscription.created' webhook as a Checkout session would.
  await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
    // Intentionally NOT passing metadata.tenant_id here! 
    // This proves the webhook handler's fallback logic (resolving via customerId) works perfectly, 
    // which is the safety net used if Checkout session metadata doesn't propagate.
  })
  console.log('Subscription created on Stripe servers. Waiting for webhook to hit Next.js and update DB...')

  console.log('\n[6] Polling local DB for reactivation...')
  let reactivated = false
  let afterState = null

  for (let i = 0; i < 15; i++) {
    await sleep(2000)
    const { data: current } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
    if (current?.status === 'active') {
      reactivated = true
      afterState = current
      break
    }
  }

  console.log('\n[7] Test Results')
  if (reactivated) {
    console.log('✅ PASS: Tenant successfully reactivated to "active" status via REAL Stripe webhook.')
    console.log('AFTER STATE:', afterState)
  } else {
    console.log('❌ FAIL: Tenant status did not change to "active" within 30 seconds.')
    const { data: finalState } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
    console.log('FINAL STATE:', finalState)
  }

  console.log('\n[8] Cleanup...')
  nextProc.kill()
  listenProc.kill()
  await stripe.prices.update(price.id, { active: false })
  await stripe.products.update(product.id, { active: false })
  await supabase.from('tenant_subscriptions').delete().eq('tenant_id', tenantId)
  await supabase.from('tenants').delete().eq('id', tenantId)

  if (!reactivated) {
    process.exit(1)
  }
}

run().catch(console.error)
