
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  console.log('Finding user by exact email...')
  const { data: userRows } = await supabase
    .from('users')
    .select('id, tenant_id, email')
    .eq('email', 'admin@devtest.local')
    
  const tenantId = userRows[0].tenant_id
  
  const { error: moduleErr } = await supabase
    .from('tenant_modules')
    .update({ enabled: true })
    .eq('tenant_id', tenantId)
    .eq('module_key', 'automation_workflows')
    
  if (moduleErr) {
    console.error('Error updating module:', moduleErr)
  } else {
    console.log('Successfully ENABLED automation_workflows module directly!')
  }
}

run().catch(console.error)

