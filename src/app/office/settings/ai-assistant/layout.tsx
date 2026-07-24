import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// tenant_admin-only, mirroring src/app/office/settings/staff/layout.tsx
// exactly — this toggle controls fully-automated customer-facing behavior
// (auto-sending real quotes/emails unattended), a materially larger blast
// radius than Branding/Pricing.
export default async function AiAssistantSettingsLayout({
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

  // HARD GUARD: only tenant_admin can access AI Assistant settings
  if (tenantRole !== 'tenant_admin') {
    redirect('/office/settings')
  }

  return children
}
