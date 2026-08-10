import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Megaphone } from 'lucide-react'
import { TenantList } from './components/tenant-list'
import { CreateTenantDialog } from './components/create-tenant-dialog'
import { SyncStripePlansButton } from './components/sync-stripe-plans-button'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()

  // 1. Secondary Server Guard (Middleware handles primary routing)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata.is_super_admin !== true) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 relative">
      {/* Subtle Gradient Mesh for Header Only */}
      <div className="absolute inset-x-0 top-0 h-[400px] -z-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/40 via-white to-white pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Tenants</h1>
            <p className="text-slate-500 mt-1">Manage and oversee all workspaces in the system.</p>
          </div>
          <div className="shrink-0 flex items-center gap-3">
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
    </div>
  )
}
