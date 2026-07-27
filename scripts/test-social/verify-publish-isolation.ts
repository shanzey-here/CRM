import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { publishToAccounts } from '../../src/modules/social/server/publish'

const REAL_ACCOUNT_ZERNIO_ID = '6a675e3a542d8bc5a628ba21' // real connected FB page "Gomove CRMDev Test"
const REAL_PROFILE_ID = '6a674be29864163b359b763c' // the Zernio profile that account actually belongs to

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: adminUser } = await supabase.from('users').select('id, tenant_id').eq('email', 'admin@devtest.local').single()
  if (!adminUser) throw new Error('admin@devtest.local not found')
  const tenantAId = adminUser.tenant_id
  console.log('Tenant A:', tenantAId)

  // Ensure the social module is actually enabled for tenant A, otherwise
  // publishToAccounts' own gate would short-circuit before ever reaching
  // the adapter — not what this test is verifying. No real plan has
  // social_media in its entitlements JSON yet (isSocialModuleEnabled()
  // has had no caller until this branch) — temporarily add it to the
  // fixture tenant's plan and restore the original value at the end.
  const { data: subRow } = await supabase.from('tenant_subscriptions').select('price_id').eq('tenant_id', tenantAId).single()
  const { data: priceRow } = await supabase.from('saas_prices').select('plan_id').eq('id', subRow!.price_id).single()
  const planId = priceRow!.plan_id
  const { data: planRow } = await supabase.from('saas_plans').select('entitlements').eq('id', planId).single()
  const originalEntitlements = planRow!.entitlements as Record<string, unknown>
  console.log('Plan entitlements.social_media (before):', originalEntitlements?.social_media)
  await supabase.from('saas_plans').update({ entitlements: { ...originalEntitlements, social_media: true } }).eq('id', planId)

  await supabase.from('tenant_modules').upsert(
    { tenant_id: tenantAId, module_key: 'social_media', enabled: true },
    { onConflict: 'tenant_id,module_key' }
  )

  // Point tenant A's cached aggregator profile at the real Zernio profile
  // that REAL_ACCOUNT_ZERNIO_ID actually belongs to — otherwise
  // getOrCreateAggregatorProfileId would provision a brand-new, unrelated
  // Zernio profile (since tenant_settings.social_aggregator_profile_id is
  // null for this fixture tenant today) and the publish would fail with a
  // profile/account mismatch, not because per-account isolation is broken.
  await supabase.from('tenant_settings').update({ social_aggregator_profile_id: REAL_PROFILE_ID }).eq('tenant_id', tenantAId)

  // Clean slate: remove any leftover rows from prior runs.
  await supabase.from('connected_social_accounts').delete().eq('tenant_id', tenantAId).eq('platform', 'facebook')

  const { data: realAccount, error: realErr } = await supabase
    .from('connected_social_accounts')
    .insert({ tenant_id: tenantAId, platform: 'facebook', aggregator_profile_id: REAL_ACCOUNT_ZERNIO_ID, display_name: 'Gomove CRMDev Test', is_active: true })
    .select('id')
    .single()
  if (realErr) throw realErr

  const { data: brokenAccount, error: brokenErr } = await supabase
    .from('connected_social_accounts')
    .insert({ tenant_id: tenantAId, platform: 'facebook', aggregator_profile_id: 'deliberately_invalid_zernio_account_id_xyz', display_name: 'Deliberately Broken Test Account', is_active: true })
    .select('id')
    .single()
  if (brokenErr) throw brokenErr

  console.log('Real account row:', realAccount.id, '-> Zernio accountId', REAL_ACCOUNT_ZERNIO_ID)
  console.log('Broken account row:', brokenAccount.id, '-> Zernio accountId deliberately_invalid_zernio_account_id_xyz')

  // --- Tenant B setup for cross-tenant isolation test ---
  const { data: tenantB } = await supabase.from('tenants').insert([{ name: 'Tenant B Social Isolation Test', slug: `tenant-b-social-${Date.now()}` }]).select().single()
  const { data: tenantBAccount, error: tbErr } = await supabase
    .from('connected_social_accounts')
    .insert({ tenant_id: tenantB!.id, platform: 'facebook', aggregator_profile_id: REAL_ACCOUNT_ZERNIO_ID, display_name: 'Tenant B Account — must never be reachable by Tenant A', is_active: true })
    .select('id')
    .single()
  if (tbErr) throw tbErr
  console.log('Tenant B:', tenantB!.id, 'account row:', tenantBAccount.id)

  console.log('\n=== Batch publish: real account + deliberately broken account + tenant B\'s account (guessed by tenant A) ===')
  const content = `Real per-account isolation test from Gomove CRM (feature/phase2-social-aggregator-integration). ${new Date().toISOString()}`
  const results = await publishToAccounts(supabase, tenantAId, {
    accountIds: [realAccount.id, brokenAccount.id, tenantBAccount.id],
    content,
  })
  console.log(JSON.stringify(results, null, 2))

  // Confirm the broken account got marked inactive (mirrors mailbox pattern).
  const { data: brokenAfter } = await supabase.from('connected_social_accounts').select('is_active').eq('id', brokenAccount.id).single()
  console.log('\nBroken account is_active after failed publish (expect false):', brokenAfter?.is_active)

  const { data: realAfter } = await supabase.from('connected_social_accounts').select('is_active').eq('id', realAccount.id).single()
  console.log('Real account is_active after successful publish (expect true, untouched):', realAfter?.is_active)

  // Cleanup
  await supabase.from('connected_social_accounts').delete().in('id', [realAccount.id, brokenAccount.id, tenantBAccount.id])
  await supabase.from('tenants').delete().eq('id', tenantB!.id)
  await supabase.from('saas_plans').update({ entitlements: originalEntitlements }).eq('id', planId)
  console.log('\nCleanup complete (plan entitlements restored to original)')
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
