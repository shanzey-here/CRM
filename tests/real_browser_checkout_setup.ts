import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  console.log('--- Real Browser Stripe Checkout Test Setup ---')
  const tenantId = crypto.randomUUID()
  const email = `test-checkout-${Date.now()}@example.com`
  const password = 'TestPassword123!'
  
  // 1. Provision suspended tenant
  console.log(`\n[1] Provisioning suspended tenant: ${tenantId}`)
  await supabase.from('tenants').insert([{ id: tenantId, name: 'Browser Reactivate Test', slug: `browser-${tenantId}` }])
  const { error: tsErr } = await supabase.from('tenant_subscriptions').upsert([{
    tenant_id: tenantId,
    status: 'suspended',
    current_period_end: new Date().toISOString()
  }], { onConflict: 'tenant_id' })
  if (tsErr) throw new Error('tsErr: ' + tsErr.message)

  // 2. Create User
  console.log(`\n[2] Provisioning user: ${email}`)
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr) throw new Error('authErr: ' + authErr.message)
  
  const userId = authData.user.id
  await supabase.from('users').insert([{ id: userId, email, full_name: 'Browser Tester' }])
  await supabase.from('tenant_users').insert([{
    tenant_id: tenantId,
    user_id: userId,
    tenant_role: 'admin' // Needs to be admin to see billing
  }])

  const { data: beforeState } = await supabase.from('tenant_subscriptions').select('*').eq('tenant_id', tenantId).single()
  console.log('\nBEFORE STATE:', beforeState)
  console.log('\n=============================================')
  console.log('✅ SETUP COMPLETE!')
  console.log('Credentials for Browser Subagent:')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log(`Tenant ID: ${tenantId}`)
  console.log('=============================================\n')
}

run().catch(console.error)
