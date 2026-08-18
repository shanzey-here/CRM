import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  // 1. Find admin@devtest.local
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, email, tenant_id')
    .eq('email', 'admin@devtest.local')
    .single()

  if (userError) {
    console.error('Failed to find user:', userError)
    return
  }
  console.log('User found:', userData)

  const tenantId = userData.tenant_id

  // 2. Find a paid plan with automation_workflows
  const { data: plans, error: planError } = await supabase
    .from('saas_plans')
    .select('*')
    .eq('is_active', true)
  
  if (planError) {
    console.error('Failed to fetch plans:', planError)
    return
  }

  const paidPlan = plans.find(p => p.name === 'Growth Plan')
  if (!paidPlan) {
    console.error('No plan with automation_workflows found. Available plans:', plans)
    return
  }
  console.log('Paid plan found:', paidPlan.name, 'ID:', paidPlan.id)

  const { data: price, error: priceError } = await supabase
    .from('saas_prices')
    .select('*')
    .eq('plan_id', paidPlan.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (priceError) {
    console.error('Failed to find price for plan:', priceError)
    return
  }
  console.log('Price found:', price.id)

  // 3. Update subscription
  const { data: currentSub, error: subErr } = await supabase
    .from('tenant_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  console.log('Current Subscription State BEFORE update:', currentSub)

  const { data: newSub, error: updateErr } = await supabase
    .from('tenant_subscriptions')
    .upsert({
      ...(currentSub || {}),
      tenant_id: tenantId,
      status: 'active',
      price_id: price.id,
      stripe_subscription_id: currentSub?.stripe_subscription_id || 'sub_test_devtest_upgrade_' + Date.now()
    })
    .select()
    .single()

  if (updateErr) {
    console.error('Failed to update subscription:', updateErr)
    return
  }
  console.log('Subscription State AFTER update:', newSub)
}

main().catch(console.error)
