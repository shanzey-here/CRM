import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { getGraduationStatus } from '../../src/modules/settings/ai-assistant/server/repository'

const TENANT_ID = process.argv[2] || 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const status = await getGraduationStatus(supabase as any, TENANT_ID)
  console.log(JSON.stringify(status, null, 2))

  const { data: rows } = await supabase
    .from('ai_draft_resolutions')
    .select('outcome, resolved_at')
    .eq('tenant_id', TENANT_ID)
    .order('resolved_at', { ascending: false })
  console.log('\nRaw rows:', JSON.stringify(rows, null, 2))
}
main()
