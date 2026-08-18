import type { AtRiskTenant } from '@/modules/platform-health/server/churn'

// Every criterion is a plain, named sentence per tenant — never a black-box
// "risk score". A tenant can carry more than one reason at once.
export function AtRiskTable({ tenants }: { tenants: AtRiskTenant[] }) {
  if (tenants.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
        No tenants currently meet either at-risk criterion.
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-3 font-medium whitespace-nowrap">Tenant</th>
              <th className="px-6 py-3 font-medium">Reason(s)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((t) => (
              <tr key={t.tenantId} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-3 font-medium text-slate-900 whitespace-nowrap align-top">{t.tenantName}</td>
                <td className="px-6 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {t.reasons.map((reason, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
