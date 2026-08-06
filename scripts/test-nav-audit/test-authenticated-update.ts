import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

async function main() {
  const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: signInData, error: signInError } = await sc.auth.signInWithPassword({
    email: 'admin@devtest.local',
    password: 'DevTest123!',
  })
  console.log('Sign-in error:', signInError ? JSON.stringify(signInError) : '(none)')
  console.log('User app_metadata:', JSON.stringify(signInData?.user?.app_metadata))

  const leadId = 'd292cd7a-576c-417c-8dee-9350bff59e67'
  const tenantId = signInData?.user?.app_metadata?.tenant_id

  const { data, error } = await sc
    .from('leads')
    .update({ priority: 'high', assigned_to: '692c5fea-f299-4458-a49a-1615d6fdc5f1' })
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .select()
    .single()

  console.log('\nUpdate result:', JSON.stringify(data))
  console.log('Update error:', error ? JSON.stringify(error) : '(none)')
}
main()
