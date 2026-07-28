import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  await supabase.from('mailbox_sync_lock').update({ is_running: false, started_at: null }).eq('id', true)
  const { data } = await supabase.from('mailbox_sync_lock').select('*').single()
  console.log('Lock reset to clean idle state:', data)
}

main()
