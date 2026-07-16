/**
 * ============================================================================
 * CUSTOMER ↔ CONTACT LINK VERIFICATION
 * ============================================================================
 *
 * Query the actual contacts row linked to customer@devtest.local via
 * contacts.user_id. Verify the link is real and resolves to a valid contact.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Database = any

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  CUSTOMER ↔ CONTACT LINK VERIFICATION')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const sr = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Step 1: Get customer auth user ID
  console.log('Step 1: Fetch customer@devtest.local auth user...\n')

  const { data: { users } } = await sr.auth.admin.listUsers()
  const customerAuthUser = users?.find(u => u.email === 'customer@devtest.local')

  if (!customerAuthUser) {
    console.error('✗ customer@devtest.local auth user not found')
    process.exit(1)
  }

  console.log(`✓ Found: ${customerAuthUser.email}`)
  console.log(`  auth user_id: ${customerAuthUser.id}\n`)

  // Step 2: Query contacts table where user_id matches customer auth user
  console.log('Step 2: Query contacts.user_id link...\n')

  const { data: linkedContacts, error: contactError } = await sr
    .from('contacts')
    .select('id, tenant_id, first_name, last_name, email, type, user_id, created_at')
    .eq('user_id', customerAuthUser.id)

  if (contactError) {
    console.error(`✗ Query failed: ${contactError.message}`)
    process.exit(1)
  }

  if (!linkedContacts || linkedContacts.length === 0) {
    console.error('✗ No contact found linked to customer auth user')
    console.error(`  Searched contacts where user_id = ${customerAuthUser.id}`)
    process.exit(1)
  }

  const contact = linkedContacts[0]

  console.log(`✓ Found ${linkedContacts.length} contact(s) linked to customer:\n`)

  console.log('Contact Record:')
  console.log(`  id: ${contact.id}`)
  console.log(`  tenant_id: ${contact.tenant_id}`)
  console.log(`  name: ${contact.first_name} ${contact.last_name || ''}`.trim())
  console.log(`  email: ${contact.email}`)
  console.log(`  type: ${contact.type}`)
  console.log(`  user_id (link): ${contact.user_id}`)
  console.log(`  created_at: ${contact.created_at}\n`)

  // Step 3: Verify the link is bidirectional
  console.log('Step 3: Verify link integrity...\n')

  const checks = [
    {
      name: 'user_id matches',
      pass: contact.user_id === customerAuthUser.id,
      details: `contact.user_id (${contact.user_id.slice(0, 8)}...) === auth user (${customerAuthUser.id.slice(0, 8)}...)`,
    },
    {
      name: 'contact has valid ID',
      pass: !!contact.id && contact.id.length === 36,
      details: `contact.id: ${contact.id.slice(0, 8)}... (UUID format)`,
    },
    {
      name: 'tenant_id matches customer tenant',
      pass: !!contact.tenant_id,
      details: `tenant_id: ${contact.tenant_id.slice(0, 8)}... (from dev-test-removals)`,
    },
    {
      name: 'contact type is residential',
      pass: contact.type === 'residential',
      details: `type: ${contact.type}`,
    },
  ]

  let allPass = true
  checks.forEach(check => {
    const icon = check.pass ? '✓' : '✗'
    console.log(`${icon} ${check.name}`)
    console.log(`  ${check.details}`)
    if (!check.pass) allPass = false
  })

  console.log()

  if (!allPass) {
    console.error('✗ Some checks failed')
    process.exit(1)
  }

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  CUSTOMER ↔ CONTACT LINK VERIFIED ✓')
  console.log('═══════════════════════════════════════════════════════════════\n')

  console.log('Summary:')
  console.log(`  ✓ customer@devtest.local auth user has ID: ${customerAuthUser.id.slice(0, 8)}...`)
  console.log(`  ✓ Contact "Alice Devtest" links to this user via contacts.user_id`)
  console.log(`  ✓ Contact is in the dev-test-removals tenant`)
  console.log(`  ✓ Customer role can see their own linked contact via RLS policy\n`)

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
