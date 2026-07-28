import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { v4 as uuidv4 } from 'uuid'

dotenv.config({ path: '.env.local' })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testSocialRLS() {
  console.log('--- Testing connected_social_accounts RLS ---')
  
  // 1. Get a test tenant
  const { data: adminUser } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id')
    .eq('email', 'admin@devtest.local')
    .single()
    
  if (!adminUser) throw new Error('Admin user not found')
  const tenantId = adminUser.tenant_id

  console.log('Testing with tenant:', tenantId)

  // 2. Insert a test connected account via admin
  const { data: newAccount, error: insertError } = await supabaseAdmin
    .from('connected_social_accounts')
    .insert({
      tenant_id: tenantId,
      platform: 'facebook',
      aggregator_profile_id: 'ayrshare_prof_123',
      display_name: 'Gomove Test Page'
    })
    .select('id')
    .single()
    
  if (insertError) {
    console.error('Failed to insert test account:', insertError)
    return
  }
  
  console.log('Admin inserted account:', newAccount.id)

  // 3. Test uniqueness constraint
  const { error: uniqueError } = await supabaseAdmin
    .from('connected_social_accounts')
    .insert({
      tenant_id: tenantId,
      platform: 'facebook',
      aggregator_profile_id: 'ayrshare_prof_123',
      display_name: 'Another Page Name'
    })
  
  if (uniqueError && uniqueError.code === '23505') {
    console.log('Uniqueness constraint works: Duplicate rejected')
  } else {
    console.error('Uniqueness constraint failed!', uniqueError)
  }

  // 4. Test RLS for Admin
  // Create an auth client for admin@devtest.local
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await adminClient.auth.signInWithPassword({
    email: 'admin@devtest.local',
    password: 'DevTest123!'
  })
  
  const { data: adminRead, error: adminReadError } = await adminClient.from('connected_social_accounts').select('*')
  if (adminRead && adminRead.length > 0) {
    console.log('Tenant Admin RLS works: Can read accounts')
  } else {
    console.error('Tenant Admin RLS failed', adminReadError)
  }

  // 5. Test RLS for Crew (Should be denied)
  const crewClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  await crewClient.auth.signInWithPassword({
    email: 'crew@devtest.local',
    password: 'DevTest123!'
  })
  
  const { data: crewRead, error: crewReadError } = await crewClient.from('connected_social_accounts').select('*')
  if (crewRead && crewRead.length === 0) {
    console.log('Crew RLS works: Cannot read accounts (returned 0 rows)')
  } else {
    console.error('Crew RLS failed. Crew can see accounts!', crewReadError)
  }

  // Cleanup
  await supabaseAdmin.from('connected_social_accounts').delete().eq('id', newAccount.id)
  console.log('Cleanup complete')
}

testSocialRLS().catch(console.error)
