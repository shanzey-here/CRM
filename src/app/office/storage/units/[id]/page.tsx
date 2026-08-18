import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getStorageUnit } from '@/modules/storage/server/repository'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function StorageUnitDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) redirect('/login')

  const tenantId = user.app_metadata.tenant_id
  const unit = await getStorageUnit(supabase, tenantId, params.id)

  if (!unit) notFound()

  // Fetch crates assigned to this unit
  const { data: crates } = await supabase
    .from('crates')
    .select('*, contacts(first_name, last_name)')
    .eq('tenant_id', tenantId)
    .eq('storage_unit_id', unit.id)
    .order('crate_number', { ascending: true })

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="mb-4">
        <Link href="/office/storage/units" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Storage Units
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-8">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Unit #{unit.unit_number}</h1>
            <p className="text-slate-500 mt-1">
              Capacity: {unit.capacity_cubic_feet} cu ft • {unit.location_notes || 'No location notes'}
            </p>
          </div>
          <div>
            <Badge variant={unit.is_available ? 'default' : 'secondary'} className={unit.is_available ? 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200' : ''}>
              {unit.is_available ? 'Available' : 'Unavailable'}
            </Badge>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            Assigned Crates
            <Badge variant="secondary" className="rounded-full">{crates?.length || 0}</Badge>
          </h2>

          {crates && crates.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="pb-3 px-4">Crate #</th>
                    <th className="pb-3 px-4">Status</th>
                    <th className="pb-3 px-4">Contact</th>
                    <th className="pb-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {crates.map((crate: any) => (
                    <tr key={crate.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-slate-900">{crate.crate_number}</td>
                      <td className="py-3 px-4 text-slate-500 capitalize">{crate.status.replace('_', ' ')}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {crate.contacts ? `${crate.contacts.first_name} ${crate.contacts.last_name}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href={`/office/storage/crates/${crate.id}`} className="text-emerald-600 hover:underline font-medium">
                          Manage &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-slate-500 text-sm">No crates are currently assigned to this unit.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
