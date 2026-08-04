import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: admin } = await serviceClient.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const { data, error } = await serviceClient
    .from('leads')
    .select('id, stage, updated_at, contact_id')
    .eq('tenant_id', admin!.tenant_id)
    .order('updated_at', { ascending: false })
    .limit(5)
  console.log('5 most recently updated leads for this tenant:')
  console.log(JSON.stringify(data, null, 2))
  console.log('error:', error?.message || '(none)')
}
main()
