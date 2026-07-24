import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { error } = await supabase.from('email_messages').select('ai_metadata').limit(1)
  if (error) {
    console.log('Column does NOT exist yet:', error.message)
  } else {
    console.log('Column exists — migration 00054 has been applied.')
  }
}
main()
