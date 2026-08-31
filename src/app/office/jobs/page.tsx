import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getJobsByTenant } from '@/modules/jobs/server/repository'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

export default async function JobsListPage() {
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }
  const tenantId = user.app_metadata.tenant_id

  // 2. Fetch Jobs
  const { success, jobs, error } = await getJobsByTenant(supabase, tenantId)

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Jobs</h1>
          <p className="text-slate-500 mt-1">Manage scheduled moves and active jobs.</p>
        </div>
        <Link 
          href="/office/jobs/new" 
          className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-slate-900 text-white hover:bg-slate-900/90 h-10 py-2 px-4"
        >
          New Job
        </Link>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <Link
          href="/office/jobs"
          className="pb-3 border-b-2 border-blue-600 text-blue-600 font-semibold flex items-center gap-2"
        >
          <span>All Jobs</span>
        </Link>
        <Link
          href="/office/jobs/confirmed"
          className="pb-3 text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-2"
        >
          <span>Confirmed Bookings</span>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Customer</th>
              <th className="px-6 py-3">Move Date</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {success && jobs && jobs.length > 0 ? (
              jobs.map((job: any) => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors relative group">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {job.contact?.first_name} {job.contact?.last_name || ''}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {job.move_date ? format(new Date(job.move_date), 'MMM d, yyyy') : 'TBD'}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className="capitalize">
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/office/jobs/${job.id}`} 
                      className="text-emerald-600 hover:text-emerald-700 font-medium after:absolute after:inset-0"
                    >
                      View Details &rarr;
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  {error ? `Error: ${error}` : 'No jobs found. Accept a quote to create a job.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
