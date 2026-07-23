import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { spawn } from 'child_process'
import crypto from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function run() {
  console.log('--- Real Stripe Manual Suspension Conflict Test ---')
  const tenantId = crypto.randomUUID()
  
  // 1. Provision active tenant
  console.log(`\n[1] Provisioning active tenant: ${tenantId}`)
  await supabase.from('tenants').insert([{ id: tenantId, name: 'Suspend Conflict Test', slug: `suspend-${tenantId}` }])
  const { error: tsErr } = await supabase.from('tenant_subscriptions').upsert([{
    tenant_id: tenantId,
    status: 'active',
    current_period_end: new Date(Date.now() + 86400000).toISOString(),
    manually_suspended: false
  }], { onConflict: 'tenant_id' })
  if (tsErr) throw new Error('tsErr: ' + tsErr.message)

  // 2. Super-admin manually suspends the tenant
  console.log('\n[2] Super-admin manually suspends the tenant...')
  const { error: suspendErr } = await supabase.from('tenant_subscriptions').update({
    manually_suspended: true,
    suspension_reason: 'Violation of terms'
  }).eq('tenant_id', tenantId)
  if (suspendErr) throw new Error('suspendErr: ' + suspendErr.message)

  const { data: suspendedState } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
  console.log('STATE AFTER SUSPENSION:', suspendedState)
  if (!suspendedState?.manually_suspended) throw new Error('Tenant was not suspended correctly')

  // 3. Start Stripe Listen and extract secret
  console.log('\n[3] Setting up real webhook pipeline...')
  
  const listenProc = spawn('stripe', ['listen', '--api-key', process.env.STRIPE_SECRET_KEY!, '--forward-to', 'http://localhost:3000/api/webhooks/stripe-subscriptions'], { shell: true })
  
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

  // 4. Start Next.js with the extracted secret
  console.log('\n[4] Starting Next.js server with webhook secret...')
  const nextProc = spawn('npm', ['run', 'dev'], { 
    shell: true,
    env: { ...process.env, STRIPE_SUBSCRIPTIONS_WEBHOOK_SECRET: webhookSecret }
  })

  let nextReady = false
  nextProc.stdout.on('data', (data) => {
    const msg = data.toString()
    if (msg.includes('Ready in') || msg.includes('compiled in')) nextReady = true
  })
  nextProc.stderr.on('data', (data) => {
    const msg = data.toString()
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

  // 5. Create a Stripe Subscription to inject an event
  console.log('\n[5] Using actual app logic to get/create Stripe Customer ID...')
  const { getOrCreateStripeCustomerId } = await import('../src/modules/subscriptions/server/stripe-billing')
  const { stripe } = await import('../src/modules/payments/server/stripe')
  const customerResult = await getOrCreateStripeCustomerId(supabase, tenantId)
  if ('error' in customerResult) throw new Error(customerResult.error)
  const customerId = customerResult.customerId
  
  console.log('\n[6] Creating temporary Stripe Product, Price, and attaching Payment Method...')
  const product = await stripe.products.create({ name: 'Suspension E2E Test Plan' })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000,
    currency: 'usd',
    recurring: { interval: 'month' }
  })

  const pm = await stripe.paymentMethods.attach('pm_card_visa', { customer: customerId })
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: pm.id }
  })

  console.log('\n[7] Simulating billing cycle by creating a real Subscription in Stripe...')
  await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: price.id }],
  })
  
  console.log('Subscription created. Waiting 15s for webhook to hit Next.js and update DB...')
  await sleep(15000)

  // 8. Verify state
  const { data: finalState } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
  console.log('\n[8] FINAL STATE AFTER WEBHOOK:', finalState)

  if (finalState?.manually_suspended === true && finalState?.status === 'active') {
    console.log('\n✅ SUCCESS: Webhook processed (status is active) but tenant remains manually_suspended = true.')
  } else {
    console.error('\n❌ FAILURE: Manual suspension state was lost or status is incorrect.', finalState)
  }

  console.log('\n[9] Cleaning up test data...')
  nextProc.kill()
  listenProc.kill()
  await stripe.prices.update(price.id, { active: false })
  await stripe.products.update(product.id, { active: false })
  await supabase.from('tenant_subscriptions').delete().eq('tenant_id', tenantId)
  await supabase.from('tenants').delete().eq('id', tenantId)

  if (!(finalState?.manually_suspended === true && finalState?.status === 'active')) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

run().catch(e => {
  console.error('Test script failed:', e)
  process.exit(1)
})
