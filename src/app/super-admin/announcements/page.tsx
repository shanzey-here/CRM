import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTenants } from '../actions'
import { listAnnouncementsForSuperAdmin } from '@/modules/announcements/server/repository'
import { getAvailablePlans } from '@/modules/subscriptions/server/repository'
import { AnnouncementDialog } from './components/announcement-dialog'
import { AnnouncementList } from './components/announcement-list'

export default async function SuperAdminAnnouncementsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata.is_super_admin !== true) {
    redirect('/login')
  }

  const [announcements, tenants, plans] = await Promise.all([
    listAnnouncementsForSuperAdmin(supabase),
    getTenants(),
    getAvailablePlans(supabase),
  ])

  const tenantOptions = (tenants ?? []).map((t) => ({ id: t.id, name: t.name }))
  const planOptions = (plans ?? []).map((p) => ({ id: p.id, name: p.name }))

  return (
    <div className="min-h-screen bg-white text-slate-900 relative">
      <div className="absolute inset-x-0 top-0 h-[400px] -z-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/40 via-white to-white pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 pb-5 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Announcements</h1>
            <p className="text-slate-500 mt-1">
              Push headline banners to tenant admins across the platform.
            </p>
          </div>
          <div className="shrink-0">
            <AnnouncementDialog tenants={tenantOptions} plans={planOptions} />
          </div>
        </div>

        <AnnouncementList announcements={announcements ?? []} tenants={tenantOptions} plans={planOptions} />
      </div>
    </div>
  )
}
