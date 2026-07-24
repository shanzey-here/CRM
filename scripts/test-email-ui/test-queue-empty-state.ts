import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  // Fresh throwaway tenant — zero pending drafts by construction.
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({ name: 'Empty Queue Test Tenant', slug: `empty-queue-test-${Date.now()}` })
    .select('id')
    .single()
  if (tenantErr || !tenant) throw new Error(`Failed to create tenant: ${tenantErr?.message}`)

  const { data: authUsers } = await supabase.auth.admin.listUsers()
  let user = authUsers.users.find((u) => u.email === 'admin-empty-queue@test.local')
  if (!user) {
    const { data: created } = await supabase.auth.admin.createUser({
      email: 'admin-empty-queue@test.local',
      password: 'DevTest123!',
      email_confirm: true,
      app_metadata: { tenant_role: 'tenant_admin', tenant_id: tenant.id },
    })
    user = created.user!
    await supabase.from('users').insert({ id: user.id, tenant_id: tenant.id, role: 'tenant_admin', full_name: 'Empty Queue Admin', email: user.email, is_active: true })
  }

  const cookieJar: Record<string, string> = {}
  const authClient = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return Object.entries(cookieJar).map(([name, value]) => ({ name, value })) }, setAll(c) { c.forEach(({ name, value }) => { cookieJar[name] = value }) } },
  })
  await authClient.auth.signInWithPassword({ email: 'admin-empty-queue@test.local', password: 'DevTest123!' })
  const cookieHeader = Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')

  const res = await fetch('http://localhost:3000/office/email/review-queue', { headers: { Cookie: cookieHeader } })
  const html = await res.text()
  console.log('status:', res.status)
  console.log('Contains "You\'re all caught up"?', html.includes("You&#x27;re all caught up") || html.includes("You're all caught up"))

  // Cleanup
  await supabase.from('users').delete().eq('id', user.id)
  await supabase.auth.admin.deleteUser(user.id)
  await supabase.from('tenants').delete().eq('id', tenant.id)
  console.log('Cleaned up empty-queue test tenant')
}
main().catch((err) => console.error('FAILED:', err))
