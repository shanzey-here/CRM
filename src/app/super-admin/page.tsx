import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { TenantList } from './components/tenant-list'
import { CreateTenantDialog } from './components/create-tenant-dialog'

export default async function SuperAdminDashboard() {
  const supabase = await createClient()

  // 1. Secondary Server Guard (Middleware handles primary routing)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata.is_super_admin !== true) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Platform Tenants</h1>
            <p className="text-slate-400 mt-1">Manage and oversee all workspaces in the system.</p>
          </div>
          <div className="shrink-0">
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
