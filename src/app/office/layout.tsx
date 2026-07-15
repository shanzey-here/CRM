import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function OfficeLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // 1. Fetch User and enforce authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // 2. Strict Role Guard
  // The `/office` route is strictly for tenant staff.
  const appMetadata = user.app_metadata || {}
  const role = appMetadata.role
  const tenantId = appMetadata.tenant_id

  if (!tenantId) {
    // If somehow a super_admin lands here or a malformed user, redirect out
    redirect('/login?error=no_tenant_context')
  }

  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    // Crew and Customers are forbidden from the office dashboard
    redirect('/login?error=unauthorized_role')
  }

  // 3. Layout Render
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* We can add a global office sidebar/header here in the future */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
