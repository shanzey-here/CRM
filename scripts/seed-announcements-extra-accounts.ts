/**
 * Extra dev fixtures for verifying the Announcements feature:
 *  - admin2@devtest.local — a SECOND tenant_admin on the existing dev-test-removals
 *    tenant (to verify one admin dismissing a banner doesn't hide it for another).
 *  - A second tenant ("second-dev-removals") with its own tenant_admin
 *    (admin@second-dev-removals.local) — for cross-tenant isolation checks.
 *
 * Idempotent, dev-only, same production guard as seed-dev-accounts.ts.
 * Usage: npx tsx scripts/seed-announcements-extra-accounts.ts
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const KNOWN_PROD_PATTERNS = ['gomove.', 'production.', 'prod.', 'app.']
if (KNOWN_PROD_PATTERNS.some((p) => SUPABASE_URL.toLowerCase().includes(p))) {
  console.error('ABORTED: Supabase URL looks like production.')
  process.exit(1)
}

const DEV_PASSWORD = 'DevTest123!'
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureUser(email: string, fullName: string, tenantId: string, role: string) {
  const { data: existingList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let authId = existingList?.users?.find((u) => u.email === email)?.id

  if (!authId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { tenant_role: role, tenant_id: tenantId },
    })
    if (error || !data.user) throw new Error(`Failed to create ${email}: ${error?.message}`)
    authId = data.user.id
    console.log(`  ✓ Created auth user ${email} -> ${authId}`)
  } else {
    console.log(`  ↩ Auth user ${email} already exists -> ${authId}`)
  }

  const { data: existingPublic } = await supabase.from('users').select('id').eq('id', authId).maybeSingle()
  if (!existingPublic) {
    const { error } = await supabase.from('users').insert({
      id: authId,
      email,
      full_name: fullName,
      role,
      tenant_id: tenantId,
      is_active: true,
    })
    if (error) throw new Error(`Failed to create public.users row for ${email}: ${error.message}`)
    console.log(`  ✓ Created public.users row for ${email}`)
  } else {
    console.log(`  ↩ public.users row for ${email} already exists`)
  }

  return authId!
}

async function main() {
  console.log('── Ensuring dev-test-removals tenant exists ──')
  const { data: tenantA } = await supabase.from('tenants').select('id').eq('slug', 'dev-test-removals').single()
  if (!tenantA) throw new Error('dev-test-removals tenant not found — run seed-dev-accounts.ts first')
  console.log(`  Tenant A: ${tenantA.id}`)

  console.log('\n── Second tenant_admin on dev-test-removals ──')
  const admin2Id = await ensureUser('admin2@devtest.local', 'Second Tenant Admin (Dev)', tenantA.id, 'tenant_admin')

  console.log('\n── Second tenant ──')
  let tenantB: { id: string }
  const { data: existingTenantB } = await supabase.from('tenants').select('id').eq('slug', 'second-dev-removals').maybeSingle()
  if (existingTenantB) {
    tenantB = existingTenantB
    console.log(`  ↩ Tenant B already exists -> ${tenantB.id}`)
  } else {
    const { data: newTenantB, error } = await supabase
      .from('tenants')
      .insert({ name: 'Second Dev Removals', slug: 'second-dev-removals' })
      .select('id')
      .single()
    if (error || !newTenantB) throw new Error(`Failed to create tenant B: ${error?.message}`)
    tenantB = newTenantB
    console.log(`  ✓ Created Tenant B -> ${tenantB.id}`)
  }

  const adminBId = await ensureUser('admin@second-dev-removals.local', 'Tenant B Admin (Dev)', tenantB.id, 'tenant_admin')

  console.log('\nDone. Summary:')
  console.log(JSON.stringify({
    tenantA: tenantA.id,
    admin2Id,
    tenantB: tenantB.id,
    adminBId,
    password: DEV_PASSWORD,
  }, null, 2))
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
