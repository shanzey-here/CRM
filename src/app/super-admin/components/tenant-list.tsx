import { getTenants } from '../actions'

export async function TenantList() {
  const tenants = await getTenants()

  if (!tenants || tenants.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center text-slate-400">
        No tenants found. Create one to get started.
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Slug</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-200">{tenant.name}</td>
                <td className="px-6 py-4 text-slate-400 font-mono text-xs">{tenant.slug}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    tenant.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
