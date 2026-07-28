import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  await supabase.from('mailboxes').update({ is_active: true, last_sync_error: null }).eq('id', '0e7c9558-a064-4a63-b490-e845bdd54c9c')
  console.log('Reset broken mailbox to active for re-test')
}

main()
