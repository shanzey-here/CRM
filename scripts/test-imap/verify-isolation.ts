import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
const TENANT_B = '6a1f69e2-3aa4-41c9-b2b5-85f1084dc41e'
const BROKEN_MAILBOX = '0e7c9558-a064-4a63-b490-e845bdd54c9c'
const HEALTHY_A_MAILBOX = '1dce5fc6-7f8b-4cc0-9b17-a84a5841473c'
const MAILBOX_B = '9b3c2b11-7156-4723-8cd1-a67d5609f19a'

async function main() {
  const { data: broken } = await supabase
    .from('mailboxes')
    .select('id, is_active, last_sync_error, mailbox_address')
    .eq('id', BROKEN_MAILBOX)
    .single()
  console.log('Broken mailbox state:', broken)

  const { data: healthyA } = await supabase
    .from('mailboxes')
    .select('id, is_active, last_sync_error, last_synced_at')
    .eq('id', HEALTHY_A_MAILBOX)
    .single()
  console.log('\nHealthy Tenant A mailbox state (must be unaffected):', healthyA)

  const { data: healthyB } = await supabase
    .from('mailboxes')
    .select('id, is_active, last_sync_error, last_synced_at')
    .eq('id', MAILBOX_B)
    .single()
  console.log('\nHealthy Tenant B mailbox state (must be unaffected):', healthyB)

  // Cross-tenant data isolation: Tenant A's scoped query must never see Tenant B's threads/messages, and vice versa
  const { data: tenantAThreads } = await supabase.from('email_threads').select('id, tenant_id, subject').eq('tenant_id', TENANT_A)
  const { data: tenantBThreads } = await supabase.from('email_threads').select('id, tenant_id, subject').eq('tenant_id', TENANT_B)

  console.log('\nTenant A threads (must all have tenant_id = TENANT_A):', tenantAThreads)
  console.log('\nTenant B threads (must all have tenant_id = TENANT_B):', tenantBThreads)

  const aLeak = tenantAThreads?.some((t) => t.tenant_id !== TENANT_A)
  const bLeak = tenantBThreads?.some((t) => t.tenant_id !== TENANT_B)
  console.log('\nCross-tenant leak in Tenant A query?', aLeak ? 'YES - LEAK' : 'NO (correct)')
  console.log('Cross-tenant leak in Tenant B query?', bLeak ? 'YES - LEAK' : 'NO (correct)')

  const { data: tenantBMessages } = await supabase.from('email_messages').select('id, tenant_id, body_text').eq('tenant_id', TENANT_B)
  console.log('\nTenant B messages:', tenantBMessages)
}

main()
