import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function checkUser() {
  const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()
  if (error) {
    console.error(error)
    return
  }

  const user = users.users.find(u => u.email === 'admin@devtest.local')
  if (!user) {
    console.log('User not found in auth')
    return
  }

  console.log('Auth User App Metadata:')
  console.log(JSON.stringify(user.app_metadata, null, 2))
}

checkUser().catch(console.error)
