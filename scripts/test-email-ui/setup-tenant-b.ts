import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: tenantB } = await supabase
    .from('tenants')
    .insert([{ name: 'Tenant B Email Inbox UI Test', slug: `tenant-b-inbox-ui-${Date.now()}` }])
    .select()
    .single()
  console.log('Tenant B:', tenantB!.id)

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: 'dispatcher-b-inbox@emailtest.local',
    password: 'DevTest123!',
    email_confirm: true,
    app_metadata: { tenant_role: 'dispatcher', tenant_id: tenantB!.id },
  })
  if (error) throw error

  await supabase.from('users').insert({
    id: created.user!.id,
    tenant_id: tenantB!.id,
    role: 'dispatcher',
    full_name: 'Dispatcher B',
    email: 'dispatcher-b-inbox@emailtest.local',
    is_active: true,
  })

  const { data: mailboxB } = await supabase
    .from('mailboxes')
    .insert({
      tenant_id: tenantB!.id,
      provider: 'imap_generic',
      connection_method: 'imap_password',
      mailbox_address: 'tenant-b-mailbox@test.example',
      is_active: true,
    })
    .select('id')
    .single()

  const { data: threadB } = await supabase
    .from('email_threads')
    .insert({
      tenant_id: tenantB!.id,
      mailbox_id: mailboxB!.id,
      subject: 'Tenant B private thread — must never appear for Tenant A',
      participant_addresses: ['tenant-b-customer@test.example'],
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  await supabase.from('email_messages').insert({
    tenant_id: tenantB!.id,
    thread_id: threadB!.id,
    mailbox_id: mailboxB!.id,
    direction: 'inbound',
    from_address: 'tenant-b-customer@test.example',
    to_addresses: ['tenant-b-mailbox@test.example'],
    body_text: 'This message belongs to Tenant B only.',
    received_at: new Date().toISOString(),
    source_message_id: `<tenant-b-${Date.now()}@test.example>`,
    authored_by: 'human',
    requires_approval: false,
  })

  console.log('TENANT_B_ID=' + tenantB!.id)
  console.log('THREAD_B_ID=' + threadB!.id)
}

main()
