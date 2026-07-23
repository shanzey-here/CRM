import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { createImapMailbox } = await import('../../src/modules/mailboxes/server/repository')

  // Tenant B — real, separate tenant
  const { data: tenantB } = await supabase
    .from('tenants')
    .insert([{ name: 'Tenant B Sync Isolation Test', slug: `tenant-b-sync-${Date.now()}` }])
    .select()
    .single()
  console.log('Tenant B created:', tenantB!.id)

  const { data: mailboxB, error: errB } = await createImapMailbox(supabase, tenantB!.id, {
    mailboxAddress: 'support@tenant-b-test.example',
    host: '127.0.0.1',
    port: 1144,
    password: 'tenantbpass',
  })
  if (errB) throw errB
  console.log('Tenant B healthy mailbox:', mailboxB!.id)

  // A genuinely broken mailbox for Tenant A — wrong password against the
  // real hoodiecrow server on port 1143 (real auth failure, not simulated).
  const TENANT_A = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
  const { data: brokenMailbox, error: errBroken } = await createImapMailbox(supabase, TENANT_A, {
    mailboxAddress: 'broken@dev-test-removals.example',
    host: '127.0.0.1',
    port: 1143,
    password: 'wrong-password-on-purpose',
  })
  if (errBroken) throw errBroken
  console.log('Tenant A broken mailbox (wrong password, for failure-isolation test):', brokenMailbox!.id)

  console.log('\nTENANT_B_ID=' + tenantB!.id)
  console.log('MAILBOX_B_ID=' + mailboxB!.id)
  console.log('BROKEN_MAILBOX_ID=' + brokenMailbox!.id)
}

main()
