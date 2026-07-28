import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const REAL_ACCOUNT_ZERNIO_ID = '6a675e3a542d8bc5a628ba21' // real connected FB page "Gomove CRMDev Test"
const REAL_PROFILE_ID = '6a674be29864163b359b763c'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: adminUser } = await supabase.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  if (!adminUser) throw new Error('admin@devtest.local not found')
  const tenantId = adminUser.tenant_id
  console.log('Tenant:', tenantId)

  const { data: subRow } = await supabase.from('tenant_subscriptions').select('price_id').eq('tenant_id', tenantId).single()
  const { data: priceRow } = await supabase.from('saas_prices').select('plan_id').eq('id', subRow!.price_id).single()
  const planId = priceRow!.plan_id
  const { data: planRow } = await supabase.from('saas_plans').select('entitlements').eq('id', planId).single()
  const entitlements = planRow!.entitlements as Record<string, unknown>
  console.log('plan_id (save this for teardown):', planId)
  console.log('original entitlements (save for teardown):', JSON.stringify(entitlements))
  await supabase.from('saas_plans').update({ entitlements: { ...entitlements, social_media: true } }).eq('id', planId)

  await supabase.from('tenant_modules').upsert({ tenant_id: tenantId, module_key: 'social_media', enabled: true }, { onConflict: 'tenant_id,module_key' })

  await supabase.from('tenant_settings').update({ social_aggregator_profile_id: REAL_PROFILE_ID }).eq('tenant_id', tenantId)

  await supabase.from('connected_social_accounts').delete().eq('tenant_id', tenantId).eq('platform', 'facebook')
  const { data: account, error } = await supabase
    .from('connected_social_accounts')
    .insert({ tenant_id: tenantId, platform: 'facebook', aggregator_profile_id: REAL_ACCOUNT_ZERNIO_ID, display_name: 'Gomove CRMDev Test', is_active: true })
    .select('id')
    .single()
  if (error) throw error
  console.log('Connected account row:', account.id)

  await supabase.from('scheduled_posts').delete().eq('tenant_id', tenantId)
  console.log('Cleared any leftover scheduled_posts rows for a clean history list')

  console.log('\nSetup complete. Login as admin@devtest.local / DevTest123! and visit /office/social')
}
main()
