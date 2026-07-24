import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const TENANT_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('id, name, room, default_volume, is_active')
    .eq('tenant_id', TENANT_ID)
    .eq('is_active', true)
    .order('name')
  console.log('error:', error)
  console.log(JSON.stringify(data, null, 2))
}
main()
