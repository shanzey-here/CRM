import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { cancelScheduledPost } from '../../src/modules/social/server/scheduler'

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: adminUser } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantAId = adminUser!.tenant_id

  // --- Set up Tenant B with its own scheduled post ---
  const { data: tenantB } = await serviceClient
    .from('tenants')
    .insert([{ name: 'Tenant B Social Cross-Tenant Test', slug: `tenant-b-social-${Date.now()}` }])
    .select()
    .single()

  const { data: tenantBPost, error: insertErr } = await serviceClient
    .from('scheduled_posts')
    .insert({
      tenant_id: tenantB!.id,
      content: 'Tenant B private scheduled post — must never be visible or cancellable by Tenant A',
      account_ids: ['00000000-0000-0000-0000-000000000000'],
      scheduled_for: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    .select()
    .single()
  if (insertErr) throw insertErr
  console.log('Tenant B:', tenantB!.id, 'post:', tenantBPost.id)

  // --- Test 1: Tenant A's session-scoped (RLS-backed) query must never see Tenant B's row ---
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { error: signInErr } = await anonClient.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  if (signInErr) throw signInErr

  // Deliberately NO .eq('tenant_id', ...) filter here — this probes RLS
  // itself, not just the app's own query-level filtering.
  const { data: allVisibleToA } = await anonClient.from('scheduled_posts').select('id, tenant_id, content')
  const canSeeTenantBPost = (allVisibleToA ?? []).some((p) => p.id === tenantBPost.id)
  console.log('\n=== Test 1: RLS visibility ===')
  console.log("Tenant A's session can see Tenant B's post row (must be false):", canSeeTenantBPost)
  console.log("Tenant A's session sees", allVisibleToA?.length ?? 0, 'total rows (all should be its own tenant)')

  // --- Test 2: Tenant A cannot cancel Tenant B's post via the same
  // repository function the Server Action uses, even with the exact real ID ---
  const cancelResult = await cancelScheduledPost(serviceClient, tenantAId, tenantBPost.id)
  console.log('\n=== Test 2: Cross-tenant cancel attempt ===')
  console.log('Cancel result data (must be null — no row matched tenant A + that id):', JSON.stringify(cancelResult.data))

  const { data: tenantBPostAfter } = await serviceClient.from('scheduled_posts').select('status').eq('id', tenantBPost.id).single()
  console.log("Tenant B's post status after Tenant A's cancel attempt (must still be pending):", tenantBPostAfter?.status)

  // Cleanup
  await serviceClient.from('scheduled_posts').delete().eq('id', tenantBPost.id)
  await serviceClient.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nCleanup complete')
}
main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
