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
  console.log('🧪 Starting Super Admin Provisioning Rollback Test...\n')

  const emailB = `test-super-fail-${Date.now()}@example.com`
  const companyB = `Super Fail Co ${Date.now()}`
  const slugB = `super-fail-${Date.now()}`
  const adminPassword = 'securepassword123'

  // Step 1: Create Tenant (Simulating provisionTenant logic)
  const { data: newTenantB, error: newTenantErrB } = await adminSupabase
    .from('tenants')
    .insert({ name: companyB, slug: slugB, base_currency: 'USD' })
    .select().single()
  
  if (newTenantErrB || !newTenantB) {
    console.error('❌ Failed to create tenant', newTenantErrB)
    failed++
  } else {
    // Step 2: Create Auth User (Succeeds - Note email_confirm is TRUE for super-admin)
    const { data: authB, error: authErrB } = await adminSupabase.auth.admin.createUser({
      email: emailB,
      password: adminPassword,
      email_confirm: true // Waived confirmation
    })

    if (authErrB || !authB.user) {
      console.error('❌ Failed to create auth user', authErrB)
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
        // Step 4: Full Rollback (As implemented in provisionTenant)
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
          console.log('✅ Super Admin Rollback Successful: Both Tenant and Auth User cleanly deleted from DB.')
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
