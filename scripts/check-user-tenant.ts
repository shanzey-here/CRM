import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function listAll() {
  const { data: users } = await supabase.auth.admin.listUsers({ perPage: 100 })
  for (const u of users.users) {
    console.log(`User: ${u.email} | tenant_id: ${u.app_metadata?.tenant_id} | role: ${u.app_metadata?.tenant_role || u.app_metadata?.role}`)
  }
}

listAll()
