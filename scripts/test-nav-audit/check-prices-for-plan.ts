import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: prices } = await sc.from('saas_prices').select('*, saas_plans(name, entitlements)').in('plan_id', ['c241459f-d215-4e4e-93af-fe74c6496045','9c3b6a94-3a55-4434-9c70-44ca44d7e289','a75d5ada-0802-4e45-80fd-84425d05e694'])
  console.log('Prices for zero-entitlement plans:', JSON.stringify(prices, null, 2))
}
main()
