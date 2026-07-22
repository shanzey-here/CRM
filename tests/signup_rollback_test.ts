import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

let passed = 0
let failed = 0

async function runTests() {
  console.log('🧪 Starting Signup Rollback Tests...\n')

  // --- Scenario A: Duplicate Email Rollback ---
  console.log('--- 1. Testing Duplicate Email Rollback (Step 3 Failure) ---')
  const emailA = `test-duplicate-${Date.now()}@example.com`
  const companyA = `Duplicate Test Co ${Date.now()}`
  const slugA = `duplicate-test-${Date.now()}`
  
  // 1. Create a tenant and user directly to simulate an existing account
  const { data: tenantA, error: errA1 } = await adminSupabase
    .from('tenants')
    .insert({ name: 'Existing Co', slug: `existing-${Date.now()}`, base_currency: 'USD' })
    .select().single()

  const { data: authA, error: errA2 } = await adminSupabase.auth.admin.createUser({
    email: emailA,
    password: 'securepassword123',
    email_confirm: true,
  })

  if (errA1 || errA2 || !tenantA || !authA.user) {
    console.error('❌ Failed to set up Scenario A pre-requisites', errA1 || errA2)
    process.exit(1)
  }

  // 2. Now simulate the signup action's orchestration logic for a duplicate email
  // Step 1: Create Tenant
  const { data: newTenantA, error: newTenantErrA } = await adminSupabase
    .from('tenants')
    .insert({ name: companyA, slug: slugA, base_currency: 'USD' })
    .select().single()

  if (newTenantErrA || !newTenantA) {
    console.error('❌ Failed to create new tenant for Scenario A', newTenantErrA)
    failed++
  } else {
    // Step 2: Attempt Auth Create (Will Fail due to Duplicate Email)
    const { error: duplicateAuthErr } = await adminSupabase.auth.admin.createUser({
      email: emailA,
      password: 'newpassword123',
      email_confirm: false
    })

    if (!duplicateAuthErr) {
      console.error('❌ Expected auth creation to fail with duplicate email, but it succeeded')
      failed++
    } else {
      // Step 3: Rollback
      await adminSupabase.from('tenants').delete().eq('id', newTenantA.id)

      // Step 4: Verify Rollback
      const { data: checkTenantA } = await adminSupabase.from('tenants').select('id').eq('id', newTenantA.id).single()
      const { data: checkSettingsA } = await adminSupabase.from('tenant_settings').select('tenant_id').eq('tenant_id', newTenantA.id)
      
      if (checkTenantA || (checkSettingsA && checkSettingsA.length > 0)) {
        console.error('❌ Duplicate Email Rollback Failed: Tenant or Settings were orphaned in the DB', checkTenantA, checkSettingsA)
        failed++
      } else {
        console.log('✅ Duplicate Email Rollback Successful: Tenant and triggers cleanly rolled back.')
        passed++
      }
    }
  }

  // Cleanup pre-requisites for Scenario A
  await adminSupabase.auth.admin.deleteUser(authA.user.id)
  await adminSupabase.from('tenants').delete().eq('id', tenantA.id)

  // --- Scenario B: Public User Insert Failure Rollback ---
  console.log('\n--- 2. Testing Public User Insert Failure Rollback (Step 4 Failure) ---')
  const emailB = `test-public-fail-${Date.now()}@example.com`
  const companyB = `Public Fail Co ${Date.now()}`
  const slugB = `public-fail-${Date.now()}`

  // Step 1: Create Tenant
  const { data: newTenantB, error: newTenantErrB } = await adminSupabase
    .from('tenants')
    .insert({ name: companyB, slug: slugB, base_currency: 'USD' })
    .select().single()
  
  if (newTenantErrB || !newTenantB) {
    console.error('❌ Failed to create tenant for Scenario B', newTenantErrB)
    failed++
  } else {
    // Step 2: Create Auth User (Succeeds)
    const { data: authB, error: authErrB } = await adminSupabase.auth.admin.createUser({
      email: emailB,
      password: 'securepassword123',
      email_confirm: false
    })

    if (authErrB || !authB.user) {
      console.error('❌ Failed to create auth user for Scenario B', authErrB)
      failed++
    } else {
      // Step 3: Simulate Public User Insert Failure (e.g. invalid role)
      const { error: publicUserErr } = await adminSupabase.from('users').insert({
        id: authB.user.id,
        tenant_id: newTenantB.id,
        role: 'invalid_role_that_does_not_exist', // This forces the insert to fail
        email: emailB,
        full_name: 'Test',
        is_active: true
      })

      if (!publicUserErr) {
        console.error('❌ Expected public user insert to fail, but it succeeded')
        failed++
      } else {
        // Step 4: Full Rollback
        await adminSupabase.auth.admin.deleteUser(authB.user.id)
        await adminSupabase.from('tenants').delete().eq('id', newTenantB.id)

        // Step 5: Verify Rollback
        const { data: checkTenantB } = await adminSupabase.from('tenants').select('id').eq('id', newTenantB.id).single()
        
        // Verify Auth User is gone
        const { data: checkAuthB } = await adminSupabase.auth.admin.getUserById(authB.user.id)
        
        if (checkTenantB || checkAuthB?.user) {
          console.error('❌ Full Rollback Failed: Tenant or Auth User were orphaned!', { tenant: checkTenantB, auth: checkAuthB?.user?.id })
          failed++
        } else {
          console.log('✅ Full Rollback Successful: Both Tenant and Auth User cleanly deleted from DB.')
          passed++
        }
      }
    }
  }

  console.log('\n================================')
  console.log(`Test Summary: ${passed} Passed | ${failed} Failed`)
  console.log('================================')
  
  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch(console.error)
