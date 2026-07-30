import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Direct invocation of the Server Actions logic to verify the UI boundary.
import {
  getConversionFunnel,
  getRepeatCustomers,
  getContactLtv
} from '../../src/modules/analytics/server/repository'

config({ path: '.env.local' })
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('--- Verifying UI Layer Server Actions ---')

  // Setup mock tenants
  const tenantAdminId = crypto.randomUUID()
  const tenantNoAuthId = crypto.randomUUID()

  await supabase.from('tenants').insert([
    { id: tenantAdminId, name: 'UI Test Tenant (Entitled)', slug: `ui-test-${Date.now()}` },
    { id: tenantNoAuthId, name: 'UI Test Tenant (No Auth)', slug: `ui-noauth-${Date.now()}` }
  ])
  
  await supabase.from('tenant_modules').insert([
    { id: crypto.randomUUID(), tenant_id: tenantAdminId, module_key: 'analytics', enabled: true }
    // tenantNoAuthId has no entitlement
  ])

  // Mock contact
  const contactId = crypto.randomUUID()
  await supabase.from('contacts').insert([
    { id: contactId, tenant_id: tenantAdminId, first_name: 'UITestContact', type: 'residential' }
  ])

  console.log('\n[1] Testing LTV Action...')
  try {
    const ltv = await getContactLtv(supabase, tenantAdminId, contactId)
    console.log(`✅ LTV successfully retrieved: $${ltv}`)
  } catch (e: any) {
    console.error('❌ LTV failed:', e.message)
  }

  console.log('\n[2] Testing Entitlement Guard for Unentitled Tenant (Tenant B)...')
  try {
    await getConversionFunnel(supabase, tenantNoAuthId, '2026-01-01', '2026-12-31')
    throw new Error('Should have failed!')
  } catch (err: any) {
    console.log(`Received Error:`, err)
    if (err.code === 'PT403') {
      console.log(`✅ Entitlement correctly blocked with specific PT403 custom code!`)
    } else {
      console.log(`❌ Entitlement blocked but gave unexpected error code: ${err.code || err.message}`)
    }
  }

  // Cleanup
  console.log('\n[3] Cleanup...')
  await supabase.from('tenants').delete().in('id', [tenantAdminId, tenantNoAuthId])
  console.log('Done.')
}

main().catch(console.error)
