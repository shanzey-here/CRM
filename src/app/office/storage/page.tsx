import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CRATE_STATUS_LABELS, ALL_CRATE_STATUSES, CrateStatus } from '@/modules/storage/transitions'
import { listCratesWithBillingIssues } from '@/modules/storage/server/repository'

import { CrateStatsMatrix } from './components/crate-stats-matrix'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  in_warehouse: 'bg-slate-50 text-slate-600 ring-slate-500/10',
  reserved: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  with_customer: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  returned: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  lost: 'bg-red-50 text-red-700 ring-red-600/20',
  damaged: 'bg-red-50 text-red-700 ring-red-600/20',
}

export default async function StoragePage({ searchParams }: { searchParams: Promise<{ status?: string; billing_issues?: string }> }) {
  const params = await searchParams
  const statusFilter = params.status && ALL_CRATE_STATUSES.includes(params.status as CrateStatus) ? (params.status as CrateStatus) : undefined
  const billingIssuesFilter = params.billing_issues === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) redirect('/login?error=no_tenant_context')

  // Fetch stats and lists in parallel
  let crates: any[] | null = null
  let error: { message: string } | null = null
  let stats = { total: 0, available: 0, inUse: 0, billingIssues: 0 }

  const [issueCrates, statsResult] = await Promise.all([
    listCratesWithBillingIssues(supabase, tenantId),
    supabase.rpc('get_crate_stats', { p_tenant_id: tenantId })
  ])

  stats.billingIssues = issueCrates.length
  if (statsResult.data && statsResult.data.length > 0) {
    stats.total = Number(statsResult.data[0].total_crates)
    stats.available = Number(statsResult.data[0].available_crates)
    stats.inUse = Number(statsResult.data[0].in_use_crates)
  }

  if (billingIssuesFilter) {
    const crateIds = issueCrates.map((c) => c.id)
    if (crateIds.length > 0) {
      const result = await supabase
        .from('crates')
        .select('id, crate_number, status, storage_unit_id, contact_id, job_id, storage_units ( unit_number ), contacts ( first_name, last_name )')
        .eq('tenant_id', tenantId)
        .in('id', crateIds)
        .order('crate_number', { ascending: true })
      crates = result.data
      error = result.error
    } else {
      crates = []
    }
  } else {
    let query = supabase
      .from('crates')
      .select('id, crate_number, status, storage_unit_id, contact_id, job_id, storage_units ( unit_number ), contacts ( first_name, last_name )')
      .eq('tenant_id', tenantId)

    if (statusFilter) query = query.eq('status', statusFilter)

    const result = await query.order('crate_number', { ascending: true })
    crates = result.data
    error = result.error
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">Crates</h1>
          <p className="mt-2 text-sm text-slate-500">Track individual rentable crates and which storage unit or customer they're currently with.</p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <Link href="/office/storage/units" className="text-sm font-medium text-slate-600 hover:text-slate-900 self-center">
            Storage Units &rarr;
          </Link>
          <Link href="/office/storage/crates/new" className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">
            New Crate
          </Link>
        </div>
      </div>

      <CrateStatsMatrix stats={stats} />

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <Link
          href="/office/storage"
          className={`text-xs px-3 py-1.5 rounded-full font-medium ${!statusFilter && !billingIssuesFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          All
        </Link>
        {ALL_CRATE_STATUSES.map((status) => (
          <Link
            key={status}
            href={`/office/storage?status=${status}`}
            className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusFilter === status && !billingIssuesFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {CRATE_STATUS_LABELS[status]}
          </Link>
        ))}
        <Link
          href="/office/storage?billing_issues=1"
          className={`text-xs px-3 py-1.5 rounded-full font-medium ${billingIssuesFilter ? 'border-2 border-red-500 bg-white text-red-700' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
        >
          Billing issues
        </Link>
      </div>

      {error && <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">Failed to load crates: {error.message}</div>}

      <div className="mt-6 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-slate-300">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                      Crate #
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Storage Unit
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Contact
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {crates && crates.length > 0 ? (
                    crates.map((crate: any) => (
                      <tr key={crate.id} className="hover:bg-slate-50 transition-colors relative group">
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">{crate.crate_number}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_BADGE[crate.status] ?? ''}`}>
                            {CRATE_STATUS_LABELS[crate.status as CrateStatus] ?? crate.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">{crate.storage_units?.unit_number ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                          {crate.contacts ? `${crate.contacts.first_name} ${crate.contacts.last_name}` : '—'}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link href={`/office/storage/crates/${crate.id}`} className="text-blue-600 hover:text-blue-900 after:absolute after:inset-0">
                            View<span className="sr-only">, {crate.crate_number}</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                        No crates yet. Click "New Crate" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
