import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTenantUsers } from '@/modules/users/server/repository'
import { getContactsByTenant } from '@/modules/clients/server/repository'
import { getSchedulingBoardData } from '@/modules/scheduling/server/repository'
import { getBrands } from '@/modules/settings/brands/server/repository'
import { ManualJobForm } from '../components/manual-job-form'
import { format } from 'date-fns'

export const dynamic = 'force-dynamic'

export default async function NewJobPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }

  const tenantId = user.app_metadata.tenant_id
  const dateStr = format(new Date(), 'yyyy-MM-dd')

  const [staffRes, contactsRes, boardRes, brandsRes] = await Promise.all([
    getTenantUsers(supabase, tenantId),
    getContactsByTenant(supabase, tenantId),
    getSchedulingBoardData(supabase, tenantId, dateStr),
    getBrands(supabase, tenantId)
  ])

  const staff = staffRes.data || []
  const contacts = contactsRes.data || []
  const vehicles = boardRes.success && boardRes.data ? boardRes.data.vehicles : []
  const brands = brandsRes.data || []

  // Create a server-side redirect action wrapper for onSuccess since ManualJobForm is a client component
  // Wait, ManualJobForm takes onSuccess callback. In a client component, we can use router.push.
  // We'll wrap the ManualJobForm in a small client wrapper, or just use next/navigation in it.
  // Actually, we can just pass a small client component wrapper or update ManualJobForm to use router.

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Create Job</h1>
        <p className="text-slate-500 mt-1">Manually create a new job and generate an initial invoice.</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <ManualJobForm
          contacts={contacts}
          tenantStaff={staff}
          vehicles={vehicles}
          brands={brands}
        />
      </div>
    </div>
  )
}
