import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function CustomerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  const tenantId = user.app_metadata?.tenant_id

  if (role !== 'customer') {
    redirect('/')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="p-8 bg-white rounded-lg shadow-sm border max-w-md text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Customer Portal</h1>
          <p className="text-slate-600">
            Welcome to your customer portal. View your leads and job history.
          </p>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg text-left space-y-2 text-sm font-mono">
          <div>
            <span className="text-slate-500">tenant_role:</span>
            <span className="ml-2 text-slate-900 font-semibold">{role}</span>
          </div>
          <div>
            <span className="text-slate-500">tenant_id:</span>
            <span className="ml-2 text-slate-900 font-semibold">{tenantId?.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-slate-500">email:</span>
            <span className="ml-2 text-slate-900 font-semibold">{user.email}</span>
          </div>
        </div>

        <form action="/auth/signout" method="post">
          <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800">
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
