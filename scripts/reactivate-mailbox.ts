import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function activate() {
  const { data, error } = await supabase
    .from('mailboxes')
    .update({ is_active: true, last_sync_error: null })
    .eq('id', '37a0090f-9996-4fee-b513-b0e9fdd9180b')
    .select()
  console.log('Reactivated mailbox devatw3orbit@gmail.com:', data, error)
}

activate()
