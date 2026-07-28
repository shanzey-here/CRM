import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('id, tenant_id, provider, connection_method, mailbox_address, is_active, last_synced_at, last_sync_error, created_at, updated_at')
    .eq('mailbox_address', 'devatw3orbit@gmail.com')

  console.log('error:', error)
  console.log(JSON.stringify(data, null, 2))
}
main()
