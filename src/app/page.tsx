import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Route based on JWT claims set by custom_access_token_hook
  const appMetadata = user.app_metadata || {}
  const isSuperAdmin = appMetadata.is_super_admin === true
  const tenantRole = appMetadata.tenant_role ?? appMetadata.role
  const tenantId = appMetadata.tenant_id

  // Super admin goes to super-admin dashboard
  if (isSuperAdmin) {
    redirect('/super-admin')
  }

  // If user has a tenant role + tenant, route to the appropriate dashboard
  if (tenantRole && tenantId) {
    switch (tenantRole) {
      case 'tenant_admin':
      case 'dispatcher':
        redirect('/office/leads')
      case 'crew':
        redirect('/crew')
      case 'customer':
        redirect('/customer')
      default:
        break
    }
  }

  // Fallback: account pending (no role/tenant assigned yet)
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="p-8 bg-white rounded-lg shadow-sm border max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Account Pending</h1>
        <p className="text-slate-600 mb-6">
          Your account has been created but has not been assigned to a role or tenant yet.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800">
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
