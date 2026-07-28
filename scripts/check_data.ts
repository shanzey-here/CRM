import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  const tenantId = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

  const { count: jobCount } = await supabaseAdmin.from('jobs').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const { count: taskCount } = await supabaseAdmin.from('tasks').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  const { count: leadCount } = await supabaseAdmin.from('leads').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('stage', ['inquiry', 'quote_sent'])
  const { count: invoiceCount } = await supabaseAdmin.from('invoices').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['draft', 'open'])

  console.log({
    jobCount,
    taskCount,
    leadCount,
    invoiceCount
  })
}

run()
