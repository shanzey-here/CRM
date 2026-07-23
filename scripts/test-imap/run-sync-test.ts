import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { runMailboxSync } = await import('../../src/modules/mailboxes/server/sync')
  const result = await runMailboxSync(supabase as any)
  console.log('Sync run result:')
  console.log(JSON.stringify(result, null, 2))
}

main()
