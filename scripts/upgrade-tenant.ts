
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseKey) {
  console.error('Missing service role key')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Finding user admin@devtest.local...')
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr) {
    console.error('Error listing users:', userErr)
    return
  }
  
  const user = users.users.find(u => u.email === 'admin@devtest.local')
  if (!user) {
    console.error('User not found')
    return
  }
  
  const tenantId = user.app_metadata.tenant_id
  console.log('Found tenant ID:', tenantId)
  
  // Find a premium plan
  const { data: plans, error: planErr } = await supabase
    .from('saas_plans')
    .select('id, name')
    
  if (planErr) {
    console.error('Error fetching plans:', planErr)
    return
  }
  
  console.log('Available plans:', plans)
  
  // Manually enable module just in case
  const { error: moduleErr } = await supabase
    .from('tenant_modules')
    .upsert({
      tenant_id: tenantId,
      module_key: 'automation_workflows',
      enabled: true
    })
    
  if (moduleErr) {
    console.error('Error enabling module:', moduleErr)
  } else {
    console.log('Successfully enabled automation_workflows module directly!')
  }
}

run().catch(console.error)

