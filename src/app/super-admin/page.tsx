import Link from 'next/link'
import { Megaphone, BarChart3 } from 'lucide-react'
import { TenantList } from './components/tenant-list'
import { CreateTenantDialog } from './components/create-tenant-dialog'
import { SyncStripePlansButton } from './components/sync-stripe-plans-button'

// Auth guard lives once in src/app/super-admin/layout.tsx now — this page
// (and every other /super-admin page) is only ever reached after it passes.
export default async function SuperAdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Tenants</h1>
          <p className="text-slate-500 mt-1">Manage and oversee all workspaces in the system.</p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          <Link
            href="/super-admin/analytics"
            className="flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <BarChart3 size={18} />
            Analytics
          </Link>
          <Link
            href="/super-admin/announcements"
            className="flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Megaphone size={18} />
            Announcements
          </Link>
          <SyncStripePlansButton />
          <CreateTenantDialog />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        <TenantList />
      </div>

    </div>
  )
}
