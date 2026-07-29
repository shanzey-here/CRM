import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { listStorageUnits } from '@/modules/storage/server/repository'
import { CrateForm } from './components/crate-form'

export const dynamic = 'force-dynamic'

export default async function NewCratePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const units = await listStorageUnits(supabase, tenantId)

  return (
    <div className="max-w-lg mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">New Crate</h1>
      <CrateForm units={units.map((u) => ({ id: u.id, unit_number: u.unit_number }))} />
    </div>
  )
}
