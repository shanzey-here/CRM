'use client'

import { useState, useMemo } from 'react'
import { TenantActions } from './tenant-actions'
import { Search, Filter, Building2 } from 'lucide-react'
import { format } from 'date-fns'

interface TenantSubscriptionRecord {
  status?: string | null
  manually_suspended?: boolean | null
  saas_prices?: {
    saas_plans?: {
      name?: string | null
    } | null
  } | null
}

interface TenantRecord {
  id: string
  name: string
  slug: string
  created_at: string
  tenant_subscriptions?: TenantSubscriptionRecord | TenantSubscriptionRecord[] | null
}

export function TenantTable({ tenants }: { tenants: TenantRecord[] }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const processedTenants = useMemo(() => {
    return (tenants || []).map((tenant) => {
      const sub = Array.isArray(tenant.tenant_subscriptions)
        ? tenant.tenant_subscriptions[0]
        : tenant.tenant_subscriptions

      const rawStatus = sub?.status || 'unknown'
      const isSuspended = Boolean(sub?.manually_suspended || rawStatus === 'suspended')
      const isManualSuspension = Boolean(sub?.manually_suspended)
      const planName =
        sub?.saas_prices?.saas_plans?.name || (rawStatus === 'trialing' ? 'Trial' : 'No Plan')

      return {
        ...tenant,
        sub,
        rawStatus,
        isSuspended,
        isManualSuspension,
        planName,
      }
    })
  }, [tenants])

  const filteredTenants = useMemo(() => {
    return processedTenants.filter((tenant) => {
      const matchesSearch =
        tenant.name.toLowerCase().includes(search.toLowerCase()) ||
        tenant.slug.toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      if (statusFilter === 'all') return true
      if (statusFilter === 'suspended') return tenant.isSuspended
      if (statusFilter === 'active') return !tenant.isSuspended && tenant.rawStatus === 'active'
      if (statusFilter === 'trialing') return !tenant.isSuspended && tenant.rawStatus === 'trialing'
      if (statusFilter === 'past_due') return tenant.rawStatus === 'past_due'

      return tenant.rawStatus === statusFilter
    })
  }, [processedTenants, search, statusFilter])

  if (!tenants || tenants.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 shadow-sm">
        <Building2 className="mx-auto h-12 w-12 text-slate-300 mb-3" />
        <h3 className="text-base font-semibold text-slate-900">No workspaces found</h3>
        <p className="text-sm text-slate-500 mt-1">Create your first tenant workspace to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search workspaces or slugs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
          <div className="flex gap-1.5 shrink-0">
            {[
              { label: 'All', value: 'all' },
              { label: 'Active', value: 'active' },
              { label: 'Trialing', value: 'trialing' },
              { label: 'Suspended', value: 'suspended' },
              { label: 'Past Due', value: 'past_due' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-3.5 font-medium">Workspace</th>
                <th className="px-6 py-3.5 font-medium">Slug</th>
                <th className="px-6 py-3.5 font-medium">Plan</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 font-medium">Created At</th>
                <th className="px-6 py-3.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 text-sm">
                    No workspaces match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => {
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {tenant.name}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                        <span className="bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                          {tenant.slug}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {tenant.planName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                            tenant.isSuspended
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : tenant.rawStatus === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tenant.rawStatus === 'trialing'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : tenant.rawStatus === 'past_due'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {tenant.isSuspended
                            ? tenant.isManualSuspension
                              ? 'suspended (manual)'
                              : 'suspended'
                            : tenant.rawStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs" suppressHydrationWarning>
                        {tenant.created_at
                          ? format(new Date(tenant.created_at), 'dd MMM yyyy')
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <TenantActions tenantId={tenant.id} isSuspended={tenant.isSuspended} />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {filteredTenants.length} of {processedTenants.length} workspace
            {processedTenants.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  )
}
