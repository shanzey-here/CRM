import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
      <div className="p-8 bg-white rounded-lg shadow-sm border max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">Account Pending</h1>
        <p className="text-slate-600 mb-6">
          Your account has been created but has not been assigned to a role or tenant yet.
        </p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800">
            Sign Out
          </button>
        </form>
      </div>
    </div>
  )
}
