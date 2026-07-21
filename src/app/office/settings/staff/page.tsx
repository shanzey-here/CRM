import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTenantStaff } from '@/modules/users/server/repository'
import { StaffList } from './components/staff-list'
import { InviteStaffForm } from './components/invite-staff-form'

export const dynamic = 'force-dynamic'

export default async function StaffSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: staff, error } = await getTenantStaff(supabase, tenantId)

  if (error) {
    return <div>Failed to load staff list</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Staff Management</h1>
        <p className="text-sm text-slate-500">
          Invite team members and manage their access roles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Staff List */}
        <div className="lg:col-span-2">
          <StaffList staff={staff || []} />
        </div>

        {/* Invite Form */}
        <div>
          <InviteStaffForm />
        </div>
      </div>
    </div>
  )
}
