import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const su = await supabase.from('storage_units').select('*').limit(1)
  console.log('storage_units query:', JSON.stringify(su.data), 'error:', su.error)

  const cr = await supabase.from('crates').select('*').limit(1)
  console.log('crates query:', JSON.stringify(cr.data), 'error:', cr.error)
}
main()
