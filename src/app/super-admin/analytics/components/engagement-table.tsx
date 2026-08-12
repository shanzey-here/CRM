import type { TenantEngagement } from '@/modules/platform-health/server/engagement'

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never signed in'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

// Sorted quietest-first by the server (never-signed-in first, then oldest
// last sign-in) — the order that actually helps spot tenants who've gone quiet.
export function EngagementTable({ tenants }: { tenants: TenantEngagement[] }) {
  if (tenants.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
        No tenants found.
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
            <tr>
              <th className="px-6 py-3 font-medium">Tenant</th>
              <th className="px-6 py-3 font-medium">Last sign-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.tenantId} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 font-medium text-slate-900">{t.tenantName}</td>
                <td className={`px-6 py-3 ${t.lastSignInAt ? 'text-slate-500' : 'text-slate-400 italic'}`}>
                  {formatRelative(t.lastSignInAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
