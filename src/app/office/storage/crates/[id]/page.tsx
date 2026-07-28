import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listStorageUnits, getCrateStatusHistory } from '@/modules/storage/server/repository'
import { CRATE_STATUS_LABELS, CrateStatus } from '@/modules/storage/transitions'
import { CrateStatusControl } from './components/crate-status-control'
import { StorageUnitSelect } from './components/storage-unit-select'
import { CrateAssociatePanel } from './components/crate-associate-panel'

export const dynamic = 'force-dynamic'

export default async function CrateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  const { data: crate } = await supabase
    .from('crates')
    .select(
      `id, crate_number, status, storage_unit_id, contact_id, job_id, rented_since, expected_return_date,
       contacts ( id, first_name, last_name ),
       jobs ( id, status, move_date )`
    )
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!crate) notFound()

  const units = await listStorageUnits(supabase, tenantId)
  const history = await getCrateStatusHistory(supabase, tenantId, id)

  const contact = Array.isArray(crate.contacts) ? crate.contacts[0] : crate.contacts
  const job = Array.isArray(crate.jobs) ? crate.jobs[0] : crate.jobs

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Link href="/office/storage" className="text-sm text-slate-500 hover:text-slate-800">
        &larr; All crates
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{crate.crate_number}</h1>
      </div>

      <div className="p-5 rounded-lg border border-slate-200 bg-white mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Status</h2>
        <CrateStatusControl crateId={crate.id} currentStatus={crate.status as CrateStatus} />
      </div>

      <div className="p-5 rounded-lg border border-slate-200 bg-white mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Storage unit</h2>
        <StorageUnitSelect crateId={crate.id} currentUnitId={crate.storage_unit_id} units={units.map((u) => ({ id: u.id, unit_number: u.unit_number }))} />
      </div>

      <div className="p-5 rounded-lg border border-slate-200 bg-white mb-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Rental</h2>
        <CrateAssociatePanel crateId={crate.id} currentContact={contact ?? null} currentJob={job ?? null} />
        {(crate.rented_since || crate.expected_return_date) && (
          <div className="mt-3 text-xs text-slate-500 space-y-0.5">
            {crate.rented_since && <p>Rented since: {new Date(crate.rented_since).toLocaleDateString()}</p>}
            {crate.expected_return_date && <p>Expected return: {new Date(crate.expected_return_date).toLocaleDateString()}</p>}
          </div>
        )}
      </div>

      <div className="p-5 rounded-lg border border-slate-200 bg-white">
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Status history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-slate-400">No status changes recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {entry.old_status ? CRATE_STATUS_LABELS[entry.old_status as CrateStatus] ?? entry.old_status : '—'} &rarr;{' '}
                  {entry.new_status ? CRATE_STATUS_LABELS[entry.new_status as CrateStatus] ?? entry.new_status : '—'}
                </span>
                <span className="text-xs text-slate-400">{new Date(entry.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
