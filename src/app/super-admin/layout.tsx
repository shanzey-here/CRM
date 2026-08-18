import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SuperAdminNav } from './components/super-admin-nav'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata.is_super_admin !== true) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 relative">
      {/* Subtle Gradient Mesh — shared across every /super-admin page */}
      <div className="absolute inset-x-0 top-0 h-[400px] -z-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-blue-100/40 via-white to-white pointer-events-none" />

      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/super-admin" className="text-lg font-bold text-[var(--color-primary)] shrink-0">
              Gomove <span className="text-slate-400 font-normal text-sm">Platform</span>
            </Link>
            <SuperAdminNav />
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="text-sm text-slate-500 truncate max-w-[220px]" title={user.email}>{user.email}</span>
            <form action="/auth/signout" method="POST">
              <button type="submit" className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors">
                Log Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="relative z-10">{children}</div>
    </div>
  )
}
