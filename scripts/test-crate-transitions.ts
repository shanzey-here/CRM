import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { CRATE_STATUS_TRANSITIONS, ALL_CRATE_STATUSES, CrateStatus } from '@/modules/storage/transitions'

async function testTransitions() {
  console.log('--- WIDGET VERIFICATION: Anti-Drift Transition Test ---')
  const supabase = createServiceRoleClient()

  // 1. Get a tenant
  const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
  if (!tenant) {
    console.error('No tenant found')
    process.exit(1)
  }
  const tenantId = tenant.id

  // 2. Create a temporary crate to test with
  const testCrateNumber = `TEST-DRIFT-${Date.now()}`
  const { data: crate, error: createErr } = await supabase
    .from('crates')
    .insert({ tenant_id: tenantId, crate_number: testCrateNumber, status: 'in_warehouse' })
    .select()
    .single()

  if (createErr || !crate) {
    console.error('Failed to create test crate', createErr)
    process.exit(1)
  }

  let failedTests = 0

  // 3. Test all transitions
  for (const from of ALL_CRATE_STATUSES) {
    for (const to of ALL_CRATE_STATUSES) {
      if (from === to) continue

      // Set initial state via a raw trigger-bypassing or just standard update?
      // Wait, we can't bypass the trigger via standard update.
      // If we are testing lost -> something, but we can't get to lost easily?
      // We can just DROP the trigger temporarily or create new crates starting in 'from' state?
      // Let's just create a new crate directly starting in the `from` state!
      const tempNumber = `TEST-${from}-${to}-${Date.now()}`
      
      // We need to disable the trigger briefly? No, the trigger is ON UPDATE. INSERT is fine!
      const { data: tempCrate, error: tempErr } = await supabase
        .from('crates')
        .insert({ tenant_id: tenantId, crate_number: tempNumber, status: from })
        .select()
        .single()

      if (tempErr || !tempCrate) {
        console.error(`Failed to insert temp crate for ${from}`, tempErr)
        continue
      }

      const shouldSucceed = CRATE_STATUS_TRANSITIONS[from].includes(to)

      // Try the update
      const { error: updateErr } = await supabase
        .from('crates')
        .update({ status: to })
        .eq('id', tempCrate.id)

      const didSucceed = !updateErr

      if (didSucceed !== shouldSucceed) {
        console.error(`❌ DRIFT DETECTED: ${from} -> ${to}. TS allowed: ${shouldSucceed}, DB allowed: ${didSucceed}`)
        if (updateErr) console.error('   DB Error:', updateErr.message)
        failedTests++
      } else {
        console.log(`✅ ${from} -> ${to} matched (Allowed: ${shouldSucceed})`)
      }

      // Cleanup temp crate
      await supabase.from('crates').delete().eq('id', tempCrate.id)
    }
  }

  // Cleanup main test crate
  await supabase.from('crates').delete().eq('id', crate.id)

  if (failedTests > 0) {
    console.error(`\n❌ Anti-drift test failed with ${failedTests} mismatches.`)
    process.exit(1)
  } else {
    console.log('\n✅ Anti-drift test passed. TS and DB match perfectly.')
    process.exit(0)
  }
}

testTransitions().catch(console.error)
