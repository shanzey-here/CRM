import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const { data: items } = await sc.from('inventory_items').select('id, name, room, default_volume').eq('tenant_id', admin!.tenant_id).limit(3)
  console.log('Inventory items:', JSON.stringify(items, null, 2))
}
main()
