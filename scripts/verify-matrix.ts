import { config } from 'dotenv'
config({ path: '.env.local' })
import { createServiceRoleClient } from '@/lib/supabase/service-role'

async function verifyMatrix() {
  const supabase = createServiceRoleClient()

  const { data: tenant } = await supabase.from('tenants').select('id, name').limit(1).single()
  if (!tenant) {
    console.error('No tenant found')
    process.exit(1)
  }

  console.log(`Verifying matrix for Tenant: ${tenant.name}`)

  const { data: stats } = await supabase.rpc('get_crate_stats', { p_tenant_id: tenant.id })
  console.log('--- get_crate_stats result ---')
  console.log(stats)
  
  // also check billing issues
  const { data: issues } = await supabase
    .from('crate_charges')
    .select('crate_id')
    .eq('tenant_id', tenant.id)
    .in('status', ['failed', 'requires_action'])

  const distinctIssues = [...new Set((issues ?? []).map((i) => i.crate_id))]
  console.log(`Billing Issues Count: ${distinctIssues.length}`)
}

verifyMatrix().catch(console.error)
