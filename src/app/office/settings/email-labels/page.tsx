import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getLabels } from '@/modules/email-labels/server/repository'
import { LabelList } from './components/label-list'
import { LabelFormDialog } from './components/label-form-dialog'

export const dynamic = 'force-dynamic'

export default async function EmailLabelsSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role
  if (!tenantId) redirect('/login?error=no_tenant_context')
  if (tenantRole !== 'tenant_admin') {
    return <div className="text-sm text-slate-500">Only tenant admins can manage email labels.</div>
  }

  const { data: labels, error } = await getLabels(supabase, tenantId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold leading-7 text-slate-900">Email Labels</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Default labels are auto-suggested by the AI classifier; custom labels are always manual-apply only.
          </p>
        </div>
        <LabelFormDialog existingLabels={labels ?? []} />
      </div>

      {error && <div className="text-sm text-red-600">Failed to load labels: {error.message}</div>}

      <LabelList labels={labels ?? []} />
    </div>
  )
}
