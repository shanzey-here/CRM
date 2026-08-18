import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
const sc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data: admin } = await sc.from('users').select('tenant_id').eq('email', 'admin@devtest.local').single()
  const tenantId = admin!.tenant_id
  const leadId = 'd292cd7a-576c-417c-8dee-9350bff59e67'

  console.log('--- Direct service-role update with priority + assigned_to ---')
  const { data, error } = await sc
    .from('leads')
    .update({ priority: 'high', assigned_to: '692c5fea-f299-4458-a49a-1615d6fdc5f1' })
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .select()
    .single()
  console.log('Result:', JSON.stringify(data), error ? JSON.stringify(error) : '(no error)')
}
main()
