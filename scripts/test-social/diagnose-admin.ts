import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: user } = await supabase.from('users').select('id, tenant_id, email').eq('email', 'admin@devtest.local').single()
  console.log('User:', user)
  if (!user) return

  const tenantId = user.tenant_id

  // Check tenant_modules
  const { data: tm } = await supabase.from('tenant_modules').select('*').eq('tenant_id', tenantId)
  console.log('tenant_modules:', tm)

  // Check tenant subscription
  const { data: sub } = await supabase.from('tenant_subscriptions').select('*, saas_prices(*, saas_plans(*))').eq('tenant_id', tenantId).maybeSingle()
  console.log('tenant_subscription:', JSON.stringify(sub, null, 2))

  // Check connected_social_accounts
  const { data: accounts } = await supabase.from('connected_social_accounts').select('*').eq('tenant_id', tenantId)
  console.log('connected_social_accounts:', accounts)
}

main().catch(console.error)
