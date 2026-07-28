import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
async function main() {
  const { data } = await supabase.from('tenant_settings').select('company_legal_name, ai_quoting_mode').eq('tenant_id', 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1').single()
  console.log(JSON.stringify(data, null, 2))
}
main()
