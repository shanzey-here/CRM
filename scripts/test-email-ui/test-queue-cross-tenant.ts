import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const TENANT_A_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Create a throwaway Tenant B with its own mailbox, thread, and a real
  // pending draft — distinct, recognizable content.
  const { data: tenantB, error: tenantErr } = await supabase
    .from('tenants')
    .insert({ name: 'Review Queue Test Tenant B', slug: `review-queue-test-b-${Date.now()}` })
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
      mailbox_address: 'tenantb-queue-test@example.com',
      imap_host: 'imap.example.com',
      imap_port: 993,
      is_active: true,
      encrypted_credential: Buffer.from('unused-for-this-test'),
    })
    .select('id')
    .single()
  if (mailboxErr || !mailboxB) throw new Error(`Failed to create mailbox B: ${mailboxErr?.message}`)

  const { data: threadB } = await supabase
    .from('email_threads')
    .insert({ tenant_id: tenantB.id, mailbox_id: mailboxB.id, subject: 'TENANT_B_UNIQUE_THREAD', participant_addresses: [] })
    .select('id')
    .single()

  const { data: draftB } = await supabase
    .from('email_messages')
    .insert({
      tenant_id: tenantB.id,
      thread_id: threadB!.id,
      mailbox_id: mailboxB.id,
      direction: 'outbound',
      from_address: 'tenantb-queue-test@example.com',
      to_addresses: ['someone@example.com'],
      body_text: 'TENANT_B_UNIQUE_PENDING_DRAFT_CONTENT',
      authored_by: 'ai_draft_pending',
      requires_approval: true,
    })
    .select('id')
    .single()
  console.log('Seeded Tenant B pending draft:', draftB!.id)

  // Add a real dispatcher user for Tenant B so we can sign in as them and
  // confirm their OWN queue correctly shows their own item.
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  let userB = authUsers.users.find((u) => u.email === 'dispatcher-b-queue@test.local')
  if (!userB) {
    const { data: created } = await supabase.auth.admin.createUser({
      email: 'dispatcher-b-queue@test.local',
      password: 'DevTest123!',
      email_confirm: true,
      app_metadata: { tenant_role: 'dispatcher', tenant_id: tenantB.id },
    })
    userB = created.user!
    await supabase.from('users').insert({ id: userB.id, tenant_id: tenantB.id, role: 'dispatcher', full_name: 'Dispatcher B', email: userB.email, is_active: true })
  }

  // Query as Tenant A's admin.
  const cookieJarA: Record<string, string> = {}
  const authA = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJarA).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJarA[name] = value }) } },
  })
  await authA.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeaderA = Object.entries(cookieJarA).map(([k, v]) => `${k}=${v}`).join('; ')

  const resA = await fetch('http://localhost:3000/office/email/review-queue', { headers: { Cookie: cookieHeaderA } })
  const htmlA = await resA.text()
  console.log('\n=== Tenant A queue ===')
  console.log('status:', resA.status)
  console.log('Contains Tenant B unique content?', htmlA.includes('TENANT_B_UNIQUE'))

  // Query as Tenant B's dispatcher.
  const cookieJarB: Record<string, string> = {}
  const authB = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJarB).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJarB[name] = value }) } },
  })
  await authB.auth.signInWithPassword({ email: 'dispatcher-b-queue@test.local', password: 'DevTest123!' })
  const cookieHeaderB = Object.entries(cookieJarB).map(([k, v]) => `${k}=${v}`).join('; ')

  const resB = await fetch('http://localhost:3000/office/email/review-queue', { headers: { Cookie: cookieHeaderB } })
  const htmlB = await resB.text()
  console.log('\n=== Tenant B queue ===')
  console.log('status:', resB.status)
  console.log('Contains its own TENANT_B_UNIQUE_THREAD content?', htmlB.includes('TENANT_B_UNIQUE_THREAD'))

  // Cleanup
  await supabase.from('email_messages').delete().eq('tenant_id', tenantB.id)
  await supabase.from('email_threads').delete().eq('tenant_id', tenantB.id)
  await supabase.from('mailboxes').delete().eq('tenant_id', tenantB.id)
  await supabase.from('users').delete().eq('id', userB.id)
  await supabase.auth.admin.deleteUser(userB.id)
  await supabase.from('tenants').delete().eq('id', tenantB.id)
  console.log('\nCleaned up Tenant B test data')
}
main().catch((err) => console.error('FAILED:', err))
