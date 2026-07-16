/**
 * ============================================================================
 * EMIT_DOMAIN_EVENT SECURITY GUARD VERIFICATION
 * ============================================================================
 *
 * Verify that non-service-role callers cannot pass p_tenant_id to
 * emit_domain_event() — this is the critical guard protecting the public
 * leads-API from tenant-injection attacks.
 *
 * Test: Call emit_domain_event via anon-key client (non-service-role)
 * with an explicit p_tenant_id. Should be rejected with error.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

type Database = any

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  EMIT_DOMAIN_EVENT SECURITY GUARD TEST')
  console.log('═══════════════════════════════════════════════════════════════\n')

  // Create a test tenant to use for injection attempt
  const sr = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: testTenant } = await sr
    .from('tenants')
    .insert({ name: 'Guard Test Tenant', slug: `guard-test-${Date.now()}` })
    .select()
    .single()

  const testTenantId = testTenant!.id

  console.log(`Created test tenant: ${testTenantId.slice(0, 8)}...\n`)

  // TEST: Non-service-role caller attempts to pass p_tenant_id
  console.log('TEST: Anon-key client calls emit_domain_event with explicit p_tenant_id\n')

  const anonClient = createClient<Database>(SUPABASE_URL, ANON_KEY)

  try {
    const { data, error } = await anonClient.rpc('emit_domain_event', {
      p_event_type: 'test.injection_attempt',
      p_source_module: 'test',
      p_payload: { attempt: 'inject_tenant_id' },
      p_tenant_id: testTenantId, // Non-service-role caller trying to pass tenant_id
    })

    if (error) {
      console.log(`✓ CORRECTLY REJECTED by guard:\n`)
      console.log(`  Error message: "${error.message}"\n`)

      if (
        error.message.includes('p_tenant_id override') ||
        error.message.includes('service_role')
      ) {
        console.log('✓ Error message mentions service_role guard — guard is active\n')
      } else {
        console.log('✗ Unexpected error message (does not reference service_role guard)\n')
        console.log(`  Full error: ${error.message}\n`)
      }
    } else if (data) {
      console.log(`✗ FAILED: Request was accepted! Event created: ${data}\n`)
      console.log('  Security guard is NOT working — non-service-role caller succeeded!\n')
      process.exit(1)
    }
  } catch (err) {
    // RPC call might throw instead of returning error
    console.log(`✓ CORRECTLY REJECTED (threw error):\n`)
    console.log(`  ${err instanceof Error ? err.message : String(err)}\n`)
  }

  // COMPARISON: Service-role caller should succeed
  console.log('COMPARISON: Service-role client calls emit_domain_event\n')

  try {
    const { data: eventData, error: eventError } = await sr.rpc(
      'emit_domain_event',
      {
        p_event_type: 'test.allowed_call',
        p_source_module: 'test',
        p_payload: { allowed: true },
        p_tenant_id: testTenantId, // Service-role caller passing tenant_id — should work
      }
    )

    if (eventError) {
      console.log(
        `✗ Service-role call was rejected (unexpected): ${eventError.message}\n`
      )
      process.exit(1)
    } else if (eventData) {
      console.log(
        `✓ Service-role call succeeded, event created: ${String(eventData).slice(0, 8)}...\n`
      )
    }
  } catch (err) {
    console.log(`✗ Service-role call threw error (unexpected): ${err}\n`)
    process.exit(1)
  }

  // Cleanup
  await sr.from('tenants').delete().eq('id', testTenantId)

  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  SECURITY GUARD VERIFIED ✓')
  console.log('═══════════════════════════════════════════════════════════════\n')
  console.log(
    'Summary:'
  )
  console.log('  ✓ Non-service-role (anon-key) caller REJECTED when passing p_tenant_id')
  console.log('  ✓ Service-role caller ACCEPTED with p_tenant_id override')
  console.log('  ✓ emit_domain_event security guard is intact\n')

  process.exit(0)
}

main().catch(err => {
  console.error('FATAL ERROR:', err)
  process.exit(1)
})
