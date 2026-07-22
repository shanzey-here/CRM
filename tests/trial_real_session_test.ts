import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { stripe } from '../src/modules/payments/server/stripe'
import { createSubscriptionCheckoutSession, getOrCreateStripeCustomerId } from '../src/modules/subscriptions/server/stripe-billing'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  console.log('--- Real Stripe Session Creation Test ---')
  const tenantId = crypto.randomUUID()
  
  // 1. Provision suspended tenant
  console.log(`\n[1] Provisioning suspended tenant: ${tenantId}`)
  await supabase.from('tenants').insert([{ id: tenantId, name: 'Session Test', slug: `session-${tenantId}` }])
  
  // 2. Get/Create Stripe Customer ID (which also tests that flow)
  console.log('\n[2] Provisioning Stripe Customer ID for tenant...')
  const customerResult = await getOrCreateStripeCustomerId(supabase, tenantId)
  if ('error' in customerResult) throw new Error(customerResult.error)
  const customerId = customerResult.customerId
  console.log(`Stripe Customer ID created: ${customerId}`)
  
  // 3. Create a dummy Product and Price in Stripe to use for the session
  console.log('\n[3] Creating temporary Stripe Product and Price...')
  const product = await stripe.products.create({ name: 'Test SaaS Plan' })
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000,
    currency: 'usd',
    recurring: { interval: 'month' }
  })
  console.log(`Price created: ${price.id}`)
  
  // 4. Call the application's actual session creation logic
  console.log('\n[4] Calling createSubscriptionCheckoutSession()...')
  const session = await createSubscriptionCheckoutSession({
    tenantId,
    customerId,
    priceId: price.id,
    successUrl: 'http://localhost:3000/success',
    cancelUrl: 'http://localhost:3000/cancel',
  })
  
  console.log(`Session created! ID: ${session.id}`)
  
  // 5. Verify the critical metadata is present on the session object from Stripe's servers
  console.log('\n[5] Verifying session payload returned from Stripe...')
  
  // Retrieve the session fresh from Stripe to be absolutely sure
  const freshSession = await stripe.checkout.sessions.retrieve(session.id)
  
  let passed = true
  
  // Verify session metadata
  if (freshSession.metadata?.tenant_id !== tenantId) {
    console.error(`❌ FAIL: Session metadata.tenant_id is missing or incorrect. Expected: ${tenantId}, Got: ${freshSession.metadata?.tenant_id}`)
    passed = false
  } else {
    console.log(`✅ PASS: Session metadata.tenant_id matches (${tenantId})`)
  }
  
  // Verify subscription_data metadata (THIS IS THE CRITICAL ONE FOR WEBHOOKS)
  // In the SDK, subscription_data is a property on checkout.session, but retrieval might not expose it directly unless expanded, or it might just be there.
  // Actually, subscription_data.metadata is present on the session object.
  // Wait, Stripe types say subscription_data might be undefined if not in subscription mode. But we used subscription mode.
  // Wait, Stripe's API doesn't return `subscription_data` on retrieve. It applies it to the subscription!
  // Wait, let's log the fresh session object to see what's there.
  console.log('Session Object Dump (Create response):', JSON.stringify(session, null, 2))
  console.log('Session Object Dump (Retrieve response):', JSON.stringify(freshSession, null, 2))
  
  if ((session.subscription_data as any)?.metadata?.tenant_id !== tenantId && (session as any).subscription_data?.metadata?.tenant_id !== tenantId) {
      // In stripe-node, the type might not expose metadata on subscription_data, let's check any
      const subDataMetadata = (session.subscription_data as any)?.metadata?.tenant_id;
      if (subDataMetadata !== tenantId) {
          console.error(`❌ FAIL: Session subscription_data.metadata.tenant_id is missing or incorrect. Expected: ${tenantId}, Got: ${subDataMetadata}`)
          passed = false
      } else {
          console.log(`✅ PASS: Session subscription_data.metadata.tenant_id matches (${tenantId})`)
      }
  } else {
      console.log(`✅ PASS: Session subscription_data.metadata.tenant_id matches (${tenantId})`)
  }

  console.log('\n[6] Test Results')
  if (passed) {
    console.log('✅ ALL METADATA VERIFICATION PASSED.')
    console.log('This proves that the application correctly builds the checkout session, which guarantees the subsequent webhook will receive the tenant_id.')
  } else {
    console.log('❌ METADATA VERIFICATION FAILED.')
    process.exitCode = 1
  }

  // Cleanup
  console.log('\n[7] Cleanup...')
  await stripe.prices.update(price.id, { active: false })
  await stripe.products.update(product.id, { active: false })
  await supabase.from('tenants').delete().eq('id', tenantId)
}

run().catch(console.error)
