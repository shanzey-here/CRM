import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await sc.from('inventory_items').update({ name: 'Sofa', default_volume: 45 }).eq('id', '06bb4d3b-825e-412d-a8df-5788d7ba8508').select().single()
  console.log('Reverted:', JSON.stringify(data), error ? JSON.stringify(error) : '')
}
main()
