
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('contacts')
    .select('*, leads ( id, stage, preferred_move_date, source, assigned_to, estimated_hours, estimated_crew_size, updated_at, origin_address:addresses!origin_address_id(city, postcode), destination_address:addresses!destination_address_id(city, postcode), quotes ( final_price, total_price, status ) )')
    .limit(1)
    
  if (error) {
    console.log('Query failed:', JSON.stringify(error, null, 2))
  } else {
    console.log('Query succeeded!')
  }
}
run().catch(console.error)

