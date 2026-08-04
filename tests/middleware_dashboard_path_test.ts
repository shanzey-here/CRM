import { getCorrectDashboardPath } from '../src/lib/supabase/dashboard-path'

// Regression test for the tenant_admin '/office/leads' landing-page bug
// (commit b61af524, 2026-07-20 — an unrelated middleware change silently
// overwrote the tenant_admin target). middleware.ts imports and calls this
// exact function, so this test and real runtime behavior cannot drift apart.

const cases: Array<{ label: string; metadata: any; expected: string }> = [
  { label: 'tenant_admin', metadata: { tenant_role: 'tenant_admin' }, expected: '/office' },
  { label: 'dispatcher', metadata: { tenant_role: 'dispatcher' }, expected: '/office' },
  { label: 'crew', metadata: { tenant_role: 'crew' }, expected: '/crew' },
  { label: 'customer', metadata: { tenant_role: 'customer' }, expected: '/customer' },
  { label: 'super_admin', metadata: { is_super_admin: true }, expected: '/super-admin' },
  { label: 'no role / pending account', metadata: {}, expected: '/' },
  { label: 'null metadata', metadata: null, expected: '/' },
]

console.log('--- Starting Middleware Dashboard Path Tests ---')
let failed = false

for (const { label, metadata, expected } of cases) {
  const actual = getCorrectDashboardPath(metadata)
  if (actual !== expected) {
    console.error(`❌ ${label}: expected "${expected}", got "${actual}"`)
    failed = true
  } else {
    console.log(`✅ ${label}: "${actual}"`)
  }
}

if (failed) {
  console.error('--- Middleware Dashboard Path Tests FAILED ---')
  process.exit(1)
}
console.log('--- Middleware Dashboard Path Tests PASSED ---')
