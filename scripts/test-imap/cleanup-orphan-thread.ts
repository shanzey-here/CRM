import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  await supabase.from('email_threads').delete().eq('id', '73900a44-4a0c-4050-b913-596d297dd7f6')
  console.log('Deleted orphaned empty thread from the buggy run')
}

main()
