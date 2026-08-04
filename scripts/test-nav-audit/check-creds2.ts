import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data, error } = await serviceClient.auth.admin.listUsers()
  if (error) { console.log('error', error.message); return }
  for (const u of data.users) {
    if (u.email?.includes('devtest.local')) {
      console.log(u.email, JSON.stringify(u.app_metadata))
    }
  }
}
main()
