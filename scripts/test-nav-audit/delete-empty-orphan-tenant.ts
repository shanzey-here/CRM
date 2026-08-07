import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { error } = await sc.from('tenants').delete().eq('id', '28f0b238-49be-4938-9f5c-20cc36c83986')
  console.log('Deleted empty orphan tenant:', error?.message || 'ok')
}
main()
