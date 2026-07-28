import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MailboxSettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantId = user.app_metadata?.tenant_id
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) {
    redirect('/login?error=no_tenant_context')
  }

  // HARD GUARD: only tenant_admin can connect/manage mailboxes — the OAuth
  // start route and IMAP connect action re-check this independently
  // server-side too (defense in depth, same pattern as billing/staff).
  if (tenantRole !== 'tenant_admin') {
    redirect('/office/settings')
  }

  return children
}
