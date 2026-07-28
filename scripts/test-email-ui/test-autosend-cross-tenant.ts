import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })
import { getGraduationStatus } from '../../src/modules/settings/ai-assistant/server/repository'

const TENANT_A_ID = 'edcf6f39-7fd0-4bd6-a72e-6ac215c25bf1'

const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Throwaway Tenant B with its own mailbox, its own resolution rows, and
  // its own real auto-sent (autoSent:true) message — distinct, recognizable
  // content, direct inserts (matching this project's established
  // cross-tenant-isolation test convention — no LLM calls needed to prove
  // query isolation).
  const { data: tenantB } = await service
    .from('tenants')
    .insert({ name: 'Auto-Send Test Tenant B', slug: `auto-send-test-b-${Date.now()}` })
    .select('id')
    .single()
  console.log('Created Tenant B:', tenantB!.id)

  const { data: mailboxB } = await service
    .from('mailboxes')
    .insert({
      tenant_id: tenantB!.id, provider: 'imap_generic', connection_method: 'imap_password',
      mailbox_address: 'tenantb-autosend-test@example.com', imap_host: 'imap.example.com', imap_port: 993,
      is_active: true, encrypted_credential: Buffer.from('unused'),
    })
    .select('id')
    .single()

  const { data: threadB } = await service
    .from('email_threads')
    .insert({ tenant_id: tenantB!.id, mailbox_id: mailboxB!.id, subject: 'TENANT_B_AUTOSEND_UNIQUE', participant_addresses: [] })
    .select('id')
    .single()

  // Real resolution rows for Tenant B — enough to be its OWN qualifying
  // track record, distinct from Tenant A's.
  for (let i = 0; i < 25; i++) {
    await service.from('ai_draft_resolutions').insert({
      tenant_id: tenantB!.id, mailbox_id: mailboxB!.id, thread_id: threadB!.id,
      message_id: null, outcome: 'approved_unedited',
    })
  }

  // A real auto-sent (autoSent:true) message for Tenant B.
  await service.from('email_messages').insert({
    tenant_id: tenantB!.id, thread_id: threadB!.id, mailbox_id: mailboxB!.id, direction: 'outbound',
    from_address: 'tenantb-autosend-test@example.com', to_addresses: ['someone@example.com'],
    body_text: 'TENANT_B_AUTOSENT_UNIQUE_BODY', sent_at: new Date().toISOString(),
    authored_by: 'ai_sent', requires_approval: false,
    ai_metadata: { model: 'test', promptVersion: 'v1', needsQuote: false, holdingReply: false, knownGap: false, autoSent: true },
  })

  console.log('\n=== Graduation status isolation ===')
  const statusA = await getGraduationStatus(service as any, TENANT_A_ID)
  const statusB = await getGraduationStatus(service as any, tenantB!.id)
  console.log('Tenant A status:', JSON.stringify(statusA))
  console.log('Tenant B status:', JSON.stringify(statusB), '(expect qualifies:true, 25 rows but window caps at 20)')

  // Real dispatcher user for Tenant B, to query the audit log via a real session.
  const { data: authUsers } = await service.auth.admin.listUsers()
  let userB = authUsers.users.find((u) => u.email === 'admin-b-autosend@test.local')
  if (!userB) {
    const { data: created } = await service.auth.admin.createUser({
      email: 'admin-b-autosend@test.local', password: 'DevTest123!', email_confirm: true,
      app_metadata: { tenant_role: 'tenant_admin', tenant_id: tenantB!.id },
    })
    userB = created.user!
    await service.from('users').insert({ id: userB.id, tenant_id: tenantB!.id, role: 'tenant_admin', full_name: 'Admin B', email: userB.email, is_active: true })
  }

  const cookieJarA: Record<string, string> = {}
  const authA = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJarA).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJarA[name] = value }) } },
  })
  await authA.auth.signInWithPassword({ email: 'admin@devtest.local', password: 'DevTest123!' })
  const cookieHeaderA = Object.entries(cookieJarA).map(([k, v]) => `${k}=${v}`).join('; ')

  const cookieJarB: Record<string, string> = {}
  const authB = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJarB).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJarB[name] = value }) } },
  })
  await authB.auth.signInWithPassword({ email: 'admin-b-autosend@test.local', password: 'DevTest123!' })
  const cookieHeaderB = Object.entries(cookieJarB).map(([k, v]) => `${k}=${v}`).join('; ')

  console.log('\n=== Audit log isolation ===')
  const resA = await fetch('http://localhost:3000/office/email/auto-sent-log', { headers: { Cookie: cookieHeaderA } })
  const htmlA = await resA.text()
  console.log('Tenant A log status:', resA.status)
  console.log('Tenant A log contains Tenant B unique content?', htmlA.includes('TENANT_B_AUTOSEND_UNIQUE') || htmlA.includes('TENANT_B_AUTOSENT_UNIQUE_BODY'))

  const resB = await fetch('http://localhost:3000/office/email/auto-sent-log', { headers: { Cookie: cookieHeaderB } })
  const htmlB = await resB.text()
  console.log('Tenant B log status:', resB.status)
  console.log('Tenant B log contains its own unique content?', htmlB.includes('TENANT_B_AUTOSEND_UNIQUE'))

  // Cleanup
  await service.from('email_messages').delete().eq('tenant_id', tenantB!.id)
  await service.from('ai_draft_resolutions').delete().eq('tenant_id', tenantB!.id)
  await service.from('email_threads').delete().eq('tenant_id', tenantB!.id)
  await service.from('mailboxes').delete().eq('tenant_id', tenantB!.id)
  await service.from('users').delete().eq('id', userB.id)
  await service.auth.admin.deleteUser(userB.id)
  await service.from('tenants').delete().eq('id', tenantB!.id)
  console.log('\nCleaned up Tenant B test data')
}
main().catch((err) => console.error('FAILED:', err))
