
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, leads ( id, stage, origin_address:addresses!leads_origin_address_id_fkey(city, postcode), destination_address:addresses!leads_destination_address_id_fkey(city, postcode) )')
    .limit(1)
    
  if (error) {
    console.log('Query failed:', JSON.stringify(error, null, 2))
  } else {
    console.log('Query succeeded!')
  }
}
run().catch(console.error)

