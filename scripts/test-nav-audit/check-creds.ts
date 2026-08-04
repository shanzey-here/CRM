import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  for (const email of ['crew@devtest.local', 'customer@devtest.local', 'dispatcher@devtest.local']) {
    const { data, error } = await serviceClient.from('users').select('email, tenant_role').eq('email', email).maybeSingle()
    console.log(email, '->', JSON.stringify(data), error?.message || '')
  }
}
main()
