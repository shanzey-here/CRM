import { createClient } from '@supabase/supabase-js'
import { calculateFullCycleRoute } from './src/modules/quotes/server/routing'
import { Database } from './src/types/database.types'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log('Missing env vars')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY)

async function testFullCycle() {
  console.log('Fetching a tenant...')
  const { data: tenant } = await supabase
    .from('tenant_settings')
    .select('tenant_id, address_line_1, address_city, address_postcode')
    .limit(1)
    .single()

  if (!tenant) {
    console.log('No tenant found')
    return
  }
  console.log('Tenant:', tenant)

  // Use dummy addresses for origin and destination
  const pickupAddress = {
    id: 'addr_1',
    tenant_id: tenant.tenant_id,
    line_1: '10 Downing St',
    city: 'London',
    postcode: 'SW1A 2AA',
    country: 'GB'
  } as any

  const destinationAddress = {
    id: 'addr_2',
    tenant_id: tenant.tenant_id,
    line_1: 'Buckingham Palace',
    city: 'London',
    postcode: 'SW1A 1AA',
    country: 'GB'
  } as any

  console.log('Calculating full cycle route...')
  const start = Date.now()
  const result = await calculateFullCycleRoute(supabase, tenant.tenant_id, pickupAddress, destinationAddress)
  const duration = Date.now() - start
  console.log(`Finished in ${duration}ms.`)
  console.log('Result:', JSON.stringify(result, null, 2))
}

testFullCycle().catch(console.error)
