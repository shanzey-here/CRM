import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.tenant_role

  // Workflows are systemic background rules; letting operational dispatchers 
  // define unattended system-wide behaviors is incredibly risky. This is a 
  // Settings-level capability, restricted to tenant_admin only.
  if (role !== 'tenant_admin') {
    redirect('/office')
  }

  return <>{children}</>
}
