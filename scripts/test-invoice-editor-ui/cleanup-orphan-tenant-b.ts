import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data } = await supabase.from('tenants').select('id, name').ilike('name', 'Tenant B Invoice Editor UI Test')
  console.log('Orphan tenants found:', JSON.stringify(data))
  for (const t of data || []) {
    await supabase.from('tenants').delete().eq('id', t.id)
  }
  console.log('Cleaned up.')
}
main()
