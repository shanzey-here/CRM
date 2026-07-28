import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CRATE_ID = process.argv[2]

async function main() {
  const { data: admin } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id

  const { data: rawEvents, error: rawErr } = await supabase
    .from('domain_events')
    .select('id, event_type, payload, occurred_at')
    .eq('tenant_id', tenantId)
    .eq('event_type', 'crate.status_changed')
    .order('occurred_at', { ascending: false })
  console.log('Raw crate.status_changed events for this tenant:', JSON.stringify(rawEvents, null, 2))
  console.log('rawErr:', rawErr)

  console.log('\n--- Now trying the exact filter used in getCrateStatusHistory ---')
  const { data: filtered, error: filterErr } = await supabase
    .from('domain_events')
    .select('id, payload, occurred_at')
    .eq('tenant_id', tenantId)
    .eq('event_type', 'crate.status_changed')
    .eq('payload->>crate_id', CRATE_ID)
    .order('occurred_at', { ascending: false })
  console.log('Filtered result:', JSON.stringify(filtered, null, 2))
  console.log('filterErr:', filterErr)
}
main()
