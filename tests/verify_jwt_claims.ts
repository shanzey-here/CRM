/**
 * ============================================================================
 * JWT CLAIMS VERIFICATION TEST
 * ============================================================================
 *
 * Verify that all 5 seeded accounts have correct JWT claims (tenant_role,
 * tenant_id, is_super_admin) after login via the custom_access_token_hook.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TEST_PASSWORD = 'DevTest123!'

const ACCOUNTS = [
  {
    email: 'super-admin@devtest.local',
    expectedRole: undefined,
    expectedSuperAdmin: true,
    hasTenantId: false,
    label: 'Super Admin',
  },
  {
    email: 'admin@devtest.local',
    expectedRole: 'tenant_admin',
    expectedSuperAdmin: false,
    hasTenantId: true,
    label: 'Tenant Admin',
  },
  {
    email: 'dispatcher@devtest.local',
    expectedRole: 'dispatcher',
    expectedSuperAdmin: false,
    hasTenantId: true,
    label: 'Dispatcher',
  },
  {
    email: 'crew@devtest.local',
    expectedRole: 'crew',
    expectedSuperAdmin: false,
    hasTenantId: true,
    label: 'Crew',
  },
  {
    email: 'customer@devtest.local',
    expectedRole: 'customer',
    expectedSuperAdmin: false,
    hasTenantId: true,
    label: 'Customer',
  },
]

async function verifyAccount(account: typeof ACCOUNTS[0]) {
  const supabase = createClient(SUPABASE_URL, ANON_KEY)

  // Login
  const { data: { user }, error: loginError } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: TEST_PASSWORD,
  })

  if (loginError || !user) {
    console.error(`✗ ${account.label}: Login failed — ${loginError?.message}`)
    return false
  }

  // Check JWT claims
  const appMetadata = user.app_metadata || {}
  const tenantRole = appMetadata.tenant_role ?? appMetadata.role
  const tenantId = appMetadata.tenant_id
  const isSuperAdmin = appMetadata.is_super_admin === true

  // Verify claims
  const checks = [
    {
      name: 'tenant_role',
      actual: tenantRole,
      expected: account.expectedRole,
      pass: tenantRole === account.expectedRole,
    },
    {
      name: 'tenant_id (UUID present)',
      actual: tenantId ? `${tenantId.slice(0, 8)}...` : 'null',
      expected: account.hasTenantId ? 'UUID' : 'null',
      pass: account.hasTenantId ? !!tenantId && tenantId.length === 36 : !tenantId,
    },
    {
      name: 'is_super_admin',
      actual: isSuperAdmin,
      expected: account.expectedSuperAdmin,
      pass: isSuperAdmin === account.expectedSuperAdmin,
    },
  ]

  const allPass = checks.every(c => c.pass)
  const status = allPass ? '✓' : '✗'

  console.log(`${status} ${account.label} (${account.email})`)
  checks.forEach(check => {
    const icon = check.pass ? '  ✓' : '  ✗'
    console.log(`  ${icon} ${check.name}: ${check.actual} (expected: ${check.expected})`)
  })

  if (allPass) {
    console.log()
    return true
  }

  console.log()
  return false
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  JWT CLAIMS VERIFICATION TEST')
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log('Logging in each account and checking JWT claims...\n')

  let passCount = 0

  for (const account of ACCOUNTS) {
    const pass = await verifyAccount(account)
    if (pass) passCount++
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  ${passCount}/${ACCOUNTS.length} accounts verified ✓`)
  console.log('═══════════════════════════════════════════════════════════════\n')

  if (passCount === ACCOUNTS.length) {
    console.log('SUCCESS: All accounts have correct JWT claims!\n')
    process.exit(0)
  } else {
    console.log('FAILURE: Some accounts have incorrect claims.\n')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('ERROR:', err)
  process.exit(1)
})
