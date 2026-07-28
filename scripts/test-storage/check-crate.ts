import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const CRATE_ID = process.argv[2]

async function main() {
  const { data, error } = await supabase.from('crates').select('*').eq('id', CRATE_ID).single()
  console.log(JSON.stringify(data, null, 2), error)
}
main()
