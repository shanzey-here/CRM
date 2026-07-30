import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Database } from '@/types/database.types'
import { getVehicles, getFleetAlerts } from '@/modules/fleet/server/repository'
import CreateVehicleForm from './components/create-vehicle-form'

export default async function FleetIndexPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/signin')
  }

  const tenantId = user.app_metadata.tenant_id
  const tenantRole = user.app_metadata.tenant_role

  if (!tenantId || tenantRole === 'customer') {
    redirect('/office')
  }

  const vehicles = await getVehicles(supabase, tenantId)
  const alerts = await getFleetAlerts(supabase, tenantId)

  const canEdit = tenantRole === 'tenant_admin' || tenantRole === 'dispatcher'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Fleet Management</h1>
        {canEdit && <CreateVehicleForm />}
      </div>

      {/* Fleet Alerts */}
      {(alerts.expiringDocuments.length > 0 || alerts.overdueMaintenance.length > 0) && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-3 flex items-center gap-2">
            ⚠️ Fleet Alerts
          </h2>
          
          {alerts.expiringDocuments.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-bold text-red-800 mb-2">Documents Expiring Soon</h3>
              <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                {alerts.expiringDocuments.map(doc => {
                  const isExpired = new Date(doc.expiry_date!) < new Date()
                  return (
                    <li key={doc.id}>
                      <Link href={`/office/fleet/${doc.vehicle_id}`} className="hover:underline font-medium">
                        {doc.vehicles?.name} ({doc.vehicles?.registration})
                      </Link>{' '}
                      - {doc.document_type.toUpperCase()} 
                      <span className="font-semibold ml-1">
                        ({isExpired ? 'Expired' : 'Expiring'} on {doc.expiry_date})
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {alerts.overdueMaintenance.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-red-800 mb-2">Overdue Maintenance</h3>
              <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                {alerts.overdueMaintenance.map(maint => (
                  <li key={maint.id}>
                    <Link href={`/office/fleet/${maint.vehicle_id}`} className="hover:underline font-medium">
                      {maint.vehicles?.name} ({maint.vehicles?.registration})
                    </Link>{' '}
                    - {maint.maintenance_type.toUpperCase()} 
                    <span className="font-semibold ml-1">
                      (Due since {maint.next_due_date})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Vehicle List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registration</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">View</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {vehicles.map((vehicle) => (
              <tr key={vehicle.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {vehicle.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vehicle.registration || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vehicle.type || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {vehicle.is_active ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Inactive</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link href={`/office/fleet/${vehicle.id}`} className="text-blue-600 hover:text-blue-900">
                    Manage<span className="sr-only">, {vehicle.name}</span>
                  </Link>
                </td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                  No vehicles found. Add your first vehicle to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
