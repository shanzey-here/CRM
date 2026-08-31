import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Truck, CheckCircle2 } from 'lucide-react'
import {
  getConfirmedBookingsByTenant,
  getUnlinkedConfirmedLeads,
} from '@/modules/jobs/server/repository'
import { ConfirmedBookingsTable } from './components/confirmed-bookings-table'

export const metadata = {
  title: 'Confirmed Bookings | Gomove CRM',
  description: 'Manage and track all confirmed moves and operational bookings.',
}

export const dynamic = 'force-dynamic'

export default async function ConfirmedBookingsPage() {
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }

  const tenantId = user.app_metadata.tenant_id as string

  // 2. Query Confirmed Bookings & Unlinked Pipeline Leads
  const [{ success, bookings, error }, unlinkedResult] = await Promise.all([
    getConfirmedBookingsByTenant(supabase, tenantId),
    getUnlinkedConfirmedLeads(supabase, tenantId),
  ])

  if (!success && error) {
    console.error('[ConfirmedBookingsPage] Error fetching bookings:', error)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header with Action & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Confirmed Bookings
            </h1>
            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Operational View
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            All scheduled moves and confirmed jobs ready for dispatch and execution.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/office/jobs/new"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 h-9 px-4 shadow-sm transition-colors"
            data-testid="new-job-button"
          >
            <Plus className="w-4 h-4" />
            <span>New Job</span>
          </Link>
        </div>
      </div>

      {/* Sub-Navigation Tabs: All Jobs vs Confirmed Bookings */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <Link
          href="/office/jobs"
          className="pb-3 text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-2"
        >
          <Truck className="w-4 h-4" />
          <span>All Jobs</span>
        </Link>
        <Link
          href="/office/jobs/confirmed"
          className="pb-3 border-b-2 border-blue-600 text-blue-600 font-semibold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Confirmed Bookings</span>
        </Link>
      </div>

      {/* Main Table / View Component */}
      <ConfirmedBookingsTable
        initialBookings={bookings ?? []}
        unlinkedLeadsCount={unlinkedResult.count ?? 0}
      />
    </div>
  )
}
