import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

async function main() {
  const result = await supabase
    .from('leads')
    .select('id, stage, contacts!inner ( first_name, last_name )')
    .eq('tenant_id', TENANT_A)
    .or('first_name.ilike.%a%,last_name.ilike.%a%', { foreignTable: 'contacts' })
    .limit(5)

  console.log(JSON.stringify(result, null, 2))
}

main()
