import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const REAL_ACCOUNT_ID = 'a7dc47b8-144c-41e2-aab4-4163871a7da1' // Gomove CRMDev Test connected_social_accounts row id

async function main() {
  const secondsOut = Number(process.argv[2] ?? 90)
  const { data: adminUser } = await supabase.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = adminUser!.tenant_id

  const scheduledFor = new Date(Date.now() + secondsOut * 1000).toISOString()

  const { data, error } = await supabase
    .from('scheduled_posts')
    .insert({ tenant_id: tenantId, content: `Real scheduled-post cron test. ${new Date().toISOString()}`, account_ids: [REAL_ACCOUNT_ID], scheduled_for: scheduledFor })
    .select()
    .single()
  if (error) throw error
  console.log('Seeded post:', data.id, 'scheduled_for:', data.scheduled_for, '(now:', new Date().toISOString(), ')')
}
main()
