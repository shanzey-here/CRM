import { getTenants } from '../actions'
import { TenantActions } from './tenant-actions'
export async function TenantList() {
  const tenants = await getTenants()

  if (!tenants || tenants.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 shadow-sm">
        No tenants found. Create one to get started.
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Slug</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Created At</th>
              <th className="px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map((tenant: any) => {
              const sub = Array.isArray(tenant.tenant_subscriptions) 
                ? tenant.tenant_subscriptions[0] 
                : tenant.tenant_subscriptions
              
              const status = sub?.status || 'unknown'
              const isSuspended = sub?.manually_suspended || status === 'suspended'
              
              return (
                <tr key={tenant.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{tenant.name}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{tenant.slug}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${
                      isSuspended ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {isSuspended ? 'suspended (manual)' : status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <TenantActions tenantId={tenant.id} isSuspended={!!sub?.manually_suspended} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
