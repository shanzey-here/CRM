import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data, error, count } = await supabase
    .from('domain_events')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(5)
  console.log('Error:', error)
  console.log('Count:', count)
  console.log('Data:', JSON.stringify(data, null, 2))

  // Try calling emit_domain_event directly to see what happens
  const { data: rpcData, error: rpcError } = await supabase.rpc('emit_domain_event', {
    p_event_type: 'email.received',
    p_source_module: 'email',
    p_payload: { test: true },
    p_tenant_id: 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1',
  })
  console.log('\nDirect RPC call result:', rpcData, 'error:', rpcError)
}

main()
