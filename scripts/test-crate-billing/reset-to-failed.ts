import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const chargeId = process.argv[2]

async function main() {
  await supabase.from('crate_charges').update({ status: 'failed', error: 'reset for testing' }).eq('id', chargeId)
  console.log('Reset', chargeId, 'to failed')
}
main()
