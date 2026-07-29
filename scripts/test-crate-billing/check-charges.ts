import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const crateId = process.argv[2]

async function main() {
  const { data } = await supabase.from('crate_charges').select('*').eq('crate_id', crateId).order('created_at', { ascending: false })
  console.log(JSON.stringify(data, null, 2))
}
main()
