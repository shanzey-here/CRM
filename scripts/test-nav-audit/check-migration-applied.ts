import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  // If 'stage_change' isn't a valid activity_type enum value on the real DB,
  // this filter will fail with a Postgres type-cast/enum error.
  const { data, error } = await sc.from('activities').select('id').eq('activity_type', 'stage_change').limit(1)
  console.log('Query result:', JSON.stringify(data), error ? JSON.stringify(error) : '(no error — enum value exists)')
}
main()
