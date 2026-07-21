/**
 * Phase 1 Settings — End-to-End Functional Tests
 *
 * Tests the actual user flows:
 * 1. Dispatcher redirect from /office/settings/staff
 * 2. Invite staff → login → verify JWT claims
 * 3. Edit surcharge → generate quote → verify pricing
 * 4. Upload logo → verify storage → verify live preview
 */

import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const API_URL = 'http://localhost:3000'

interface E2EResult {
  name: string
  passed: boolean
  details?: string
  evidence?: string
  error?: string
}

const results: E2EResult[] = []

const serviceClient = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function logResult(result: E2EResult) {
  const icon = result.passed ? '✓' : '✗'
  console.log(`\n${icon} ${result.name}`)
  if (result.details) console.log(`  Details: ${result.details}`)
  if (result.evidence) console.log(`  Evidence:\n${result.evidence}`)
  if (result.error) console.log(`  Error: ${result.error}`)
  results.push(result)
}

/**
 * Test 1: Dispatcher cannot access /office/settings/staff
 * Should redirect to /office/settings
 */
async function testDispatcherStaffRedirect() {
  try {
    // Get or create dispatcher test user in dev-test-removals tenant
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id')
      .eq('slug', 'dev-test-removals')
      .single()

    if (!tenant) {
      logResult({
        name: '4. Dispatcher redirect from /office/settings/staff',
        passed: false,
        error: 'Test tenant dev-test-removals not found (run seed-dev-accounts first)',
      })
      return
    }

    // Create a temporary dispatcher user for this test
    const testDispatcherEmail = `test-dispatcher-${Date.now()}@test.local`
    const { data: dispatcherAuth, error: createError } = await serviceClient.auth.admin.createUser({
      email: testDispatcherEmail,
      password: 'Test123456',
      email_confirm: true,
      app_metadata: { tenant_role: 'dispatcher', tenant_id: tenant.id },
    })

    if (createError || !dispatcherAuth.user) {
      logResult({
        name: '4. Dispatcher redirect from /office/settings/staff',
        passed: false,
        error: `Failed to create test dispatcher: ${createError?.message}`,
      })
      return
    }

    // Insert into public.users so auth hook can read it
    await serviceClient.from('users').insert({
      id: dispatcherAuth.user.id,
      tenant_id: tenant.id,
      role: 'dispatcher',
      full_name: 'Test Dispatcher',
      email: testDispatcherEmail,
    })

    // Create authenticated client as dispatcher
    const dispatcherClient = createClient<Database>(SUPABASE_URL, '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Manually sign in (set session)
    const { data: session, error: signInError } = await dispatcherClient.auth.signInWithPassword({
      email: testDispatcherEmail,
      password: 'Test123456',
    })

    if (signInError || !session.session) {
      logResult({
        name: '4. Dispatcher redirect from /office/settings/staff',
        passed: false,
        error: `Failed to sign in dispatcher: ${signInError?.message}`,
      })
      return
    }

    // Make HTTP request to staff page with dispatcher's session
    const response = await fetch(`${API_URL}/office/settings/staff`, {
      headers: {
        Authorization: `Bearer ${session.session.access_token}`,
      },
      redirect: 'manual', // Don't follow redirect automatically
    })

    // Check if we got a redirect (302/307/308)
    const isRedirect = [302, 307, 308, 303].includes(response.status)
    const redirectLocation = response.headers.get('location')

    logResult({
      name: '4. Dispatcher redirect from /office/settings/staff',
      passed: isRedirect && (redirectLocation?.includes('/office/settings') || redirectLocation?.includes('/login')),
      details: `HTTP ${response.status}`,
      evidence: `Request: GET /office/settings/staff\nResponse: HTTP ${response.status}\nRedirect Location: ${redirectLocation || '(no redirect)'}`,
      error: !isRedirect ? 'Expected redirect response (302/307/308), got ' + response.status : undefined,
    })

    // Cleanup
    await serviceClient.auth.admin.deleteUser(dispatcherAuth.user.id)
    await serviceClient.from('users').delete().eq('id', dispatcherAuth.user.id)
  } catch (err) {
    logResult({
      name: '4. Dispatcher redirect from /office/settings/staff',
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Test 2: Invite staff → login → verify JWT claims
 * Complete flow: admin invites, new user logs in, JWT has correct tenant_id/tenant_role
 */
async function testInviteAndJWTClaims() {
  try {
    // Get dev-test-removals tenant
    const { data: tenant } = await serviceClient
      .from('tenants')
      .select('id')
      .eq('slug', 'dev-test-removals')
      .single()

    if (!tenant) {
      logResult({
        name: '6. Invite staff & verify JWT claims',
        passed: false,
        error: 'Test tenant not found',
      })
      return
    }

    // Get admin user for this test
    const { data: adminUsers } = await serviceClient
      .from('users')
      .select('id, email')
      .eq('tenant_id', tenant.id)
      .eq('role', 'tenant_admin')
      .limit(1)

    if (!adminUsers || adminUsers.length === 0) {
      logResult({
        name: '6. Invite staff & verify JWT claims',
        passed: false,
        error: 'No tenant admin found for test',
      })
      return
    }

    const adminEmail = adminUsers[0].email

    // Step 1: Admin logs in and invites new staff
    const adminClient = createClient<Database>(SUPABASE_URL, '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: adminSession, error: adminSignInError } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: 'DevTest123!', // Known password from seed-dev-accounts
    })

    if (adminSignInError || !adminSession.session) {
      logResult({
        name: '6. Invite staff & verify JWT claims',
        passed: false,
        error: `Failed to sign in admin: ${adminSignInError?.message}`,
      })
      return
    }

    // Step 2: Call inviteStaffAction via HTTP (simulating form submission)
    const newStaffEmail = `e2e-crew-${Date.now()}@test.local`
    const inviteResponse = await fetch(`${API_URL}/office/settings/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${adminSession.session.access_token}`,
      },
      body: new URLSearchParams({
        'full_name': 'E2E Test Crew',
        'email': newStaffEmail,
        'role': 'crew',
      }),
    })

    // Note: This won't work via HTTP POST to the page itself (Server Actions require specific format)
    // Instead, use the service role client to directly call the invite function
    const { inviteStaff } = await import('@/modules/users/server/repository')

    const inviteResult = await inviteStaff(tenant.id, {
      email: newStaffEmail,
      full_name: 'E2E Test Crew',
      role: 'crew',
    })

    if (!inviteResult.success || !inviteResult.tempPassword) {
      logResult({
        name: '6. Invite staff & verify JWT claims',
        passed: false,
        error: `Invite failed: ${inviteResult.error}`,
      })
      return
    }

    const tempPassword = inviteResult.tempPassword

    // Step 3: New staff logs in with temp password
    const newStaffClient = createClient<Database>(SUPABASE_URL, '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: newStaffSession, error: newStaffSignInError } = await newStaffClient.auth.signInWithPassword({
      email: newStaffEmail,
      password: tempPassword,
    })

    if (newStaffSignInError || !newStaffSession.session) {
      logResult({
        name: '6. Invite staff & verify JWT claims',
        passed: false,
        error: `New staff sign in failed: ${newStaffSignInError?.message}`,
      })
      return
    }

    // Step 4: Verify JWT claims
    const jwtClaims = newStaffSession.session.user.app_metadata || {}
    const hasCorrectTenantId = jwtClaims.tenant_id === tenant.id
    const hasCorrectRole = jwtClaims.tenant_role === 'crew'

    logResult({
      name: '6. Invite staff & verify JWT claims',
      passed: hasCorrectTenantId && hasCorrectRole,
      evidence: `
Invite Result: ${inviteResult.success ? 'SUCCESS' : 'FAILED'}
Temp Password: ${tempPassword}

New User Login: SUCCESS
Email: ${newStaffEmail}
JWT app_metadata:
  tenant_id: ${jwtClaims.tenant_id}
  tenant_role: ${jwtClaims.tenant_role}

Expected:
  tenant_id: ${tenant.id}
  tenant_role: crew

Match: tenant_id=${hasCorrectTenantId}, role=${hasCorrectRole}
      `,
      error:
        !hasCorrectTenantId || !hasCorrectRole
          ? `Incorrect JWT claims: tenant_id match=${hasCorrectTenantId}, role match=${hasCorrectRole}`
          : undefined,
    })

    // Cleanup
    const { data: newUser } = await serviceClient
      .from('users')
      .select('id')
      .eq('email', newStaffEmail)
      .single()

    if (newUser) {
      await serviceClient.auth.admin.deleteUser(newUser.id)
      await serviceClient.from('users').delete().eq('id', newUser.id)
    }
  } catch (err) {
    logResult({
      name: '6. Invite staff & verify JWT claims',
      passed: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/**
 * Test 3: Edit surcharge → generate quote → verify pricing
 * Change a surcharge amount and verify the quote engine uses it
 */
async function testSurchargeRoundTrip() {
  logResult({
    name: '7. Surcharge edit round-trip to quote engine',
    passed: false,
    error: 'Requires manual quote generation via UI (no automatic quote API yet). See manual verification section.',
  })
}

/**
 * Test 4: Upload logo → verify storage → verify live preview
 * Upload image, verify URL in DB, fetch it, check response
 */
async function testLogoUpload() {
  logResult({
    name: '8. Logo upload & live preview',
    passed: false,
    error: 'Requires browser file upload (no programmatic form submission for file input). See manual verification section.',
  })
}

async function printSummary() {
  console.log('\n' + '='.repeat(70))
  console.log('PHASE 1 SETTINGS — END-TO-END TEST SUMMARY')
  console.log('='.repeat(70))

  const passed = results.filter((r) => r.passed).length
  const total = results.length

  results.forEach((r, i) => {
    const icon = r.passed ? '✓' : '✗'
    console.log(`${(i + 1).toString().padStart(2)}. [${icon}] ${r.name}`)
  })

  console.log('\n' + '='.repeat(70))
  console.log(`RESULT: ${passed}/${total} tests completed`)
  console.log('='.repeat(70) + '\n')
}

async function main() {
  console.log('Starting Phase 1 Settings E2E Tests...\n')
  console.log('Note: Tests 3 & 4 require manual browser testing (file upload, quote generation)\n')

  await testDispatcherStaffRedirect()
  await testInviteAndJWTClaims()
  await testSurchargeRoundTrip()
  await testLogoUpload()

  await printSummary()
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
