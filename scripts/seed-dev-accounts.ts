/**
 * ============================================================================
 * DEV SEED SCRIPT — seed-dev-accounts.ts
 * ============================================================================
 *
 * ⚠️  WARNING: THIS SCRIPT IS FOR DEVELOPMENT ONLY ⚠️
 *
 * DO NOT run this against a production Supabase project. It creates user
 * accounts with a known, hardcoded password and inserts fake data. It uses
 * the service_role key which bypasses all Row Level Security.
 *
 * Safe to run multiple times — it is idempotent (check-and-skip on existing
 * tenant slug and user emails).
 *
 * Usage:
 *   npx tsx scripts/seed-dev-accounts.ts
 *
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - The custom_access_token_hook must be enabled in the Supabase Dashboard
 *     (Authentication → Auth Hooks → Custom Access Token → select the function)
 *
 * ── HOW JWT CLAIMS WORK ─────────────────────────────────────────────────────
 * This script creates auth users and public.users rows. HOWEVER, the JWT
 * claims (tenant_role, tenant_id) are NOT embedded in the token at creation
 * time — the custom_access_token_hook only fires on sign-in or token refresh.
 *
 * This means: after running this script, each user must sign in once through
 * the real /login page to receive their correct JWT claims. The hook reads
 * public.users at that moment and stamps the JWT automatically.
 *
 * For super-admin@devtest.local: the is_super_admin flag is set directly on
 * raw_app_meta_data at creation time, so it will be present immediately after
 * the hook fires on first login.
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'

// Load .env.local manually (tsx doesn't auto-load it)
import { config } from 'dotenv'
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// ── PRODUCTION GUARD ─────────────────────────────────────────────────────────
// Refuse to run if the URL looks like it could be a production project.
// This is a best-effort heuristic — the definitive guard is the big warning above.
const KNOWN_PROD_PATTERNS = ['gomove.', 'production.', 'prod.', 'app.']
const urlLooksLikeProd = KNOWN_PROD_PATTERNS.some(
  (p) => SUPABASE_URL?.toLowerCase().includes(p)
)
if (urlLooksLikeProd) {
  console.error(
    '\n❌  ABORTED: The Supabase URL looks like a production project.\n' +
      '    This script must only run against a dev/staging project.\n' +
      `    URL: ${SUPABASE_URL}\n`
  )
  process.exit(1)
}

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const DEV_PASSWORD = 'DevTest123!'

const TEST_TENANT = {
  name: 'Dev Test Removals',
  slug: 'dev-test-removals',
}

const ACCOUNTS = [
  {
    email: 'super-admin@devtest.local',
    fullName: 'Super Admin (Dev)',
    role: null as null, // super-admins have no tenant role
    isSuperAdmin: true,
  },
  {
    email: 'admin@devtest.local',
    fullName: 'Tenant Admin (Dev)',
    role: 'tenant_admin' as const,
    isSuperAdmin: false,
  },
  {
    email: 'dispatcher@devtest.local',
    fullName: 'Dispatcher (Dev)',
    role: 'dispatcher' as const,
    isSuperAdmin: false,
  },
  {
    email: 'crew@devtest.local',
    fullName: 'Crew Member (Dev)',
    role: 'crew' as const,
    isSuperAdmin: false,
  },
  {
    email: 'customer@devtest.local',
    fullName: 'Customer (Dev)',
    role: 'customer' as const,
    isSuperAdmin: false,
    isCustomer: true,
  },
] as const

// ── HELPERS ───────────────────────────────────────────────────────────────────
function log(msg: string) { console.log(`  ${msg}`) }
function ok(msg: string)  { console.log(`  ✓ ${msg}`) }
function skip(msg: string){ console.log(`  ↩ ${msg} (already exists — skipped)`) }
function warn(msg: string){ console.warn(`  ⚠ ${msg}`) }
function fail(msg: string){ console.error(`  ✗ ${msg}`) }

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`\n${question} [y/N] `, (answer) => {
      rl.close()
      resolve(answer.trim().toLowerCase() === 'y')
    })
  })
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║        GOMOVE CRM — DEV SEED SCRIPT (dev-only)          ║')
  console.log('╚══════════════════════════════════════════════════════════╝')
  console.log(`\n  Target: ${SUPABASE_URL}`)
  console.log(`  Tenant: ${TEST_TENANT.name} (${TEST_TENANT.slug})`)
  console.log(`  Accounts: ${ACCOUNTS.map((a) => a.email).join(', ')}`)
  console.log(`  Password: ${DEV_PASSWORD}`)

  const proceed = await confirm('⚠  This will create real users in your Supabase project. Continue?')
  if (!proceed) {
    console.log('\nAborted.\n')
    process.exit(0)
  }

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log('\n── Step 1: Create test tenant ───────────────────────────────')

  // Check if tenant already exists
  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', TEST_TENANT.slug)
    .maybeSingle()

  let tenantId: string

  if (existingTenant) {
    skip(`Tenant "${TEST_TENANT.slug}"`)
    tenantId = existingTenant.id
  } else {
    const { data: newTenant, error } = await supabase
      .from('tenants')
      .insert({ name: TEST_TENANT.name, slug: TEST_TENANT.slug })
      .select('id')
      .single()

    if (error || !newTenant) {
      fail(`Failed to create tenant: ${error?.message}`)
      process.exit(1)
    }
    ok(`Created tenant "${TEST_TENANT.name}" → ${newTenant.id}`)
    tenantId = newTenant.id
  }

  console.log('\n── Step 2: Create auth users ────────────────────────────────')

  // Fetch all existing auth users once to check for existing emails
  const { data: existingAuthData } = await supabase.auth.admin.listUsers()
  const existingEmails = new Set(existingAuthData?.users?.map((u) => u.email) ?? [])

  const createdAuthUsers: Record<string, string> = {} // email → auth user id

  for (const account of ACCOUNTS) {
    if (existingEmails.has(account.email)) {
      // User already exists — find their ID
      const existing = existingAuthData?.users?.find((u) => u.email === account.email)
      if (existing) {
        createdAuthUsers[account.email] = existing.id
        skip(`Auth user ${account.email}`)

        // Still ensure is_super_admin is set if needed
        if (account.isSuperAdmin) {
          await supabase.auth.admin.updateUserById(existing.id, {
            app_metadata: { is_super_admin: true },
          })
        }
      }
      continue
    }

    const appMeta: Record<string, unknown> = {}
    if (account.isSuperAdmin) appMeta.is_super_admin = true
    if ('role' in account && account.role && !account.isSuperAdmin) {
      appMeta.tenant_role = account.role
      appMeta.tenant_id = tenantId
    }

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: DEV_PASSWORD,
      email_confirm: true, // pre-verified — no email confirmation needed
      user_metadata: { full_name: account.fullName },
      app_metadata: appMeta,
    })

    if (error || !created.user) {
      fail(`Failed to create ${account.email}: ${error?.message}`)
      continue
    }

    createdAuthUsers[account.email] = created.user.id
    ok(`Created auth user ${account.email} → ${created.user.id}`)
  }

  console.log('\n── Step 3: Create public.users rows ─────────────────────────')

  for (const account of ACCOUNTS) {
    const authUserId = createdAuthUsers[account.email]
    if (!authUserId) {
      warn(`Skipping public.users for ${account.email} — no auth user ID`)
      continue
    }

    // Check if public.users row already exists
    const { data: existingPublicUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle()

    if (existingPublicUser) {
      // Update role/tenant in case it changed
      await supabase
        .from('users')
        .update({
          role: account.role,
          tenant_id: account.isSuperAdmin ? null : tenantId,
          full_name: account.fullName,
          email: account.email,
        })
        .eq('id', authUserId)
      skip(`public.users row for ${account.email} (updated role/tenant)`)
      continue
    }

    const { error } = await supabase.from('users').insert({
      id: authUserId,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
      tenant_id: account.isSuperAdmin ? null : tenantId,
      is_active: true,
    })

    if (error) {
      fail(`Failed to create public.users row for ${account.email}: ${error.message}`)
    } else {
      ok(`Created public.users row for ${account.email} (role: ${account.role ?? 'super_admin'})`)
    }
  }

  console.log('\n── Step 4: Create seed contacts ─────────────────────────────')

  // Check if seed contacts already exist
  const { data: existingContacts } = await supabase
    .from('contacts')
    .select('id, first_name, user_id')
    .eq('tenant_id', tenantId)
    .in('first_name', ['Alice', 'Bob'])

  let customerContactId: string | null = null
  let regularContactId: string | null = null

  // Find existing ones
  existingContacts?.forEach((c) => {
    if (c.first_name === 'Alice') customerContactId = c.id
    if (c.first_name === 'Bob') regularContactId = c.id
  })

  const customerAuthId = createdAuthUsers['customer@devtest.local']

  if (!customerContactId) {
    // Create the customer contact — linked to the customer auth user via user_id
    const { data: customerContact, error } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        first_name: 'Alice',
        last_name: 'Devtest',
        email: 'customer@devtest.local',
        phone: '07700900001',
        type: 'residential',
        user_id: customerAuthId ?? null, // <── the customer↔contact link
        notes: 'Dev seed customer account. Linked to customer@devtest.local auth user.',
      })
      .select('id')
      .single()

    if (error || !customerContact) {
      fail(`Failed to create customer contact: ${error?.message}`)
    } else {
      customerContactId = customerContact.id
      ok(`Created contact Alice Devtest (customer) → ${customerContactId}`)
      ok(`  → user_id linked to auth user ${customerAuthId}`)
    }
  } else {
    // Ensure user_id is linked even on existing contact
    if (customerAuthId) {
      await supabase
        .from('contacts')
        .update({ user_id: customerAuthId })
        .eq('id', customerContactId)
    }
    skip(`Contact "Alice Devtest" (customer) — user_id link ensured`)
  }

  if (!regularContactId) {
    const { data: regularContact, error } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        first_name: 'Bob',
        last_name: 'Prospect',
        email: 'bob@example.com',
        phone: '07700900002',
        type: 'residential',
        notes: 'Dev seed prospect — has an active lead in the pipeline.',
      })
      .select('id')
      .single()

    if (error || !regularContact) {
      fail(`Failed to create regular contact: ${error?.message}`)
    } else {
      regularContactId = regularContact.id
      ok(`Created contact Bob Prospect → ${regularContactId}`)
    }
  } else {
    skip(`Contact "Bob Prospect"`)
  }

  console.log('\n── Step 5: Create seed leads ────────────────────────────────')

  const dispatcherAuthId = createdAuthUsers['dispatcher@devtest.local']

  // Check for existing seed leads
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('id, stage, contact_id')
    .eq('tenant_id', tenantId)
    .in('contact_id', [regularContactId, customerContactId].filter(Boolean) as string[])

  const hasLeadForBob = existingLeads?.some((l) => l.contact_id === regularContactId)
  const hasLeadForAlice = existingLeads?.some((l) => l.contact_id === customerContactId)

  if (!hasLeadForBob && regularContactId) {
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenantId,
        contact_id: regularContactId,
        stage: 'follow_up',
        source: 'website_form',
        preferred_move_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // 2 weeks from now
        estimated_volume: 35,
        notes: 'Dev seed lead — Bob wants a 2-bed move. Waiting on survey confirmation.',
        assigned_to: dispatcherAuthId ?? null,
      })
      .select('id')
      .single()

    if (error || !lead) {
      fail(`Failed to create lead for Bob: ${error?.message}`)
    } else {
      ok(`Created lead for Bob Prospect (stage: follow_up) → ${lead.id}`)
    }
  } else {
    skip(`Lead for Bob Prospect`)
  }

  if (!hasLeadForAlice && customerContactId) {
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenantId,
        contact_id: customerContactId,
        stage: 'quote_sent',
        source: 'referral',
        preferred_move_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0], // 3 weeks from now
        estimated_volume: 50,
        notes: 'Dev seed lead — Alice (the dev customer user) also has a lead, quote already sent.',
        assigned_to: dispatcherAuthId ?? null,
      })
      .select('id')
      .single()

    if (error || !lead) {
      fail(`Failed to create lead for Alice: ${error?.message}`)
    } else {
      ok(`Created lead for Alice Devtest (stage: quote_sent) → ${lead.id}`)
    }
  } else {
    skip(`Lead for Alice Devtest`)
  }

  console.log('\n── Step 6: Verify customer↔contact link ─────────────────────')

  if (customerAuthId && customerContactId) {
    const { data: linkCheck } = await supabase
      .from('contacts')
      .select('id, first_name, user_id')
      .eq('id', customerContactId)
      .single()

    if (linkCheck?.user_id === customerAuthId) {
      ok(`contacts.user_id → ${customerAuthId} ✓  (link confirmed)`)
    } else {
      fail(
        `Link mismatch! contacts.user_id is "${linkCheck?.user_id}", expected "${customerAuthId}"`
      )
    }
  } else {
    warn('Could not verify customer↔contact link (missing IDs)')
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║                    SEED COMPLETE ✓                      ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log('║  Login Credentials (all use same password)               ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log(`║  Password: ${DEV_PASSWORD.padEnd(46)}║`)
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log('║  Email                          Role          Dashboard  ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log('║  super-admin@devtest.local      super_admin   /super-admin ║')
  console.log('║  admin@devtest.local            tenant_admin  /admin       ║')
  console.log('║  dispatcher@devtest.local       dispatcher    /office      ║')
  console.log('║  crew@devtest.local             crew          /crew        ║')
  console.log('║  customer@devtest.local         customer      /            ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log('║  ⚠  JWT claims (tenant_role/tenant_id) are set on       ║')
  console.log('║     FIRST LOGIN — the Auth Hook fires at sign-in time.  ║')
  console.log('║     Just log in once and you will be routed correctly.  ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')
}

main().catch((err) => {
  console.error('\n❌  Unhandled error:', err)
  process.exit(1)
})
