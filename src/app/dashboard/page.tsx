import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Extract custom claims injected by the Edge Function
  const tenantId = user.app_metadata?.tenant_id
  const role = user.app_metadata?.tenant_role || 'No Role'
  const isSuperAdmin = user.app_metadata?.is_super_admin || false

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-8 pb-4 border-b">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors">
              Sign out
            </button>
          </form>
        </header>
        
        <div className="bg-card text-card-foreground p-6 rounded-xl border shadow-sm max-w-2xl">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            Welcome back, 
            <span className="text-primary">{user.email}</span>
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 py-2 border-b">
              <span className="font-medium w-32 text-muted-foreground">User ID</span>
              <code className="text-xs bg-muted px-2 py-1 rounded text-foreground font-mono">{user.id}</code>
            </div>
            
            <div className="flex items-center gap-4 py-2 border-b">
              <span className="font-medium w-32 text-muted-foreground">Tenant ID</span>
              {tenantId ? (
                <code className="text-xs bg-muted px-2 py-1 rounded text-foreground font-mono">{tenantId}</code>
              ) : (
                <span className="text-sm text-muted-foreground italic">None (No tenant assigned)</span>
              )}
            </div>
            
            <div className="flex items-center gap-4 py-2 border-b">
              <span className="font-medium w-32 text-muted-foreground">Role</span>
              <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-background">
                {role}
              </span>
            </div>
            
            <div className="flex items-center gap-4 py-2">
              <span className="font-medium w-32 text-muted-foreground">Super Admin</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isSuperAdmin ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {isSuperAdmin ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
