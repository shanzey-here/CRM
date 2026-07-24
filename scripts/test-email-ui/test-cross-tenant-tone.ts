import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { getToneSamples } from '../../src/modules/ai-email/server/tone'

const TENANT_A_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'
const MAILBOX_A_ID = '37a0090f-9996-4fee-b513-b0e9fdd9180b'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Create a fresh, throwaway Tenant B with its own mailbox and a couple of
  // real human-authored sent messages with distinct, recognizable content.
  const { data: tenantB, error: tenantErr } = await supabase
    .from('tenants')
    .insert({ name: 'AI Draft Test Tenant B', slug: `ai-draft-test-tenant-b-${Date.now()}` })
    .select('id')
    .single()
  if (tenantErr || !tenantB) throw new Error(`Failed to create tenant B: ${tenantErr?.message}`)
  console.log('Created Tenant B:', tenantB.id)

  const { data: mailboxB, error: mailboxErr } = await supabase
    .from('mailboxes')
    .insert({
      tenant_id: tenantB.id,
      provider: 'imap_generic',
      connection_method: 'imap_password',
      mailbox_address: 'tenantb-tone-test@example.com',
      imap_host: 'imap.example.com',
      imap_port: 993,
      is_active: true,
      encrypted_credential: Buffer.from('unused-for-this-test'),
    })
    .select('id')
    .single()
  if (mailboxErr || !mailboxB) throw new Error(`Failed to create mailbox B: ${mailboxErr?.message}`)
  console.log('Created mailbox B:', mailboxB.id)

  const { data: threadB } = await supabase
    .from('email_threads')
    .insert({ tenant_id: tenantB.id, mailbox_id: mailboxB.id, subject: 'Tenant B thread', participant_addresses: [] })
    .select('id')
    .single()

  const tenantBPhrases = [
    'TENANT_B_UNIQUE_PHRASE: cheers for choosing us, we will sort your move out no bother',
    'TENANT_B_UNIQUE_PHRASE: appreciate your patience, the van is booked for Tuesday',
  ]
  for (const phrase of tenantBPhrases) {
    await supabase.from('email_messages').insert({
      tenant_id: tenantB.id,
      thread_id: threadB!.id,
      mailbox_id: mailboxB.id,
      direction: 'outbound',
      from_address: 'tenantb-tone-test@example.com',
      to_addresses: ['someone@example.com'],
      body_text: phrase,
      sent_at: new Date().toISOString(),
      source_message_id: `<${Math.random().toString(36).slice(2)}@example.com>`,
      authored_by: 'human',
      requires_approval: false,
    })
  }
  console.log('Seeded 2 human-authored sent messages for Tenant B')

  console.log('\n--- Tenant A tone samples (real Dev Test Removals sent mail) ---')
  const tenantASamples = await getToneSamples(supabase as any, TENANT_A_ID, MAILBOX_A_ID, 10)
  console.log(JSON.stringify(tenantASamples, null, 2))

  console.log('\n--- Tenant B tone samples ---')
  const tenantBSamples = await getToneSamples(supabase as any, tenantB.id, mailboxB.id, 10)
  console.log(JSON.stringify(tenantBSamples, null, 2))

  const bleed = tenantASamples.some((s) => s.includes('TENANT_B_UNIQUE_PHRASE'))
  console.log('\nDoes Tenant A tone retrieval contain any Tenant B content?', bleed)

  // Cleanup — this is a throwaway test tenant.
  await supabase.from('email_messages').delete().eq('tenant_id', tenantB.id)
  await supabase.from('email_threads').delete().eq('tenant_id', tenantB.id)
  await supabase.from('mailboxes').delete().eq('tenant_id', tenantB.id)
  await supabase.from('tenants').delete().eq('id', tenantB.id)
  console.log('\nCleaned up Tenant B test data')
}
main().catch((err) => {
  console.error('TEST FAILED:', err)
  process.exit(1)
})
