import { config } from 'dotenv'
config({ path: '.env.local' })
import { generateAndSaveJobCompletionSummary } from '@/modules/jobs/server/completion-summary'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!) as any
  const jobId = '4dbdaea8-a9ea-45ec-b248-63ed2fa4b264'
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const result = await generateAndSaveJobCompletionSummary(sc, admin!.tenant_id, jobId)
  console.log(JSON.stringify(result, null, 2))
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
