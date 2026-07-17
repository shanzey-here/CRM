import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTasks } from '@/modules/tasks/server/repository'
import { getTenantStaff } from '@/modules/users/server/repository'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreateTaskForm } from '../components/create-task-form'
import { TasksList } from './components/tasks-list'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const supabase = await createClient()

  // 1. Authenticate and enforce Tenant Context
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.app_metadata.tenant_id) {
    redirect('/login')
  }
  const tenantId = user.app_metadata.tenant_id

  // 2. Fetch Tasks (explicit tenant scoping)
  const { data: tasks, error: tasksError } = await getTasks(supabase, tenantId)
  
  if (tasksError) {
    console.error('Failed to fetch tasks:', tasksError)
  }

  // 3. Fetch Tenant Staff for assignments
  const { data: tenantStaff } = await getTenantStaff(supabase, tenantId)

  // Filter incomplete tasks
  const incompleteTasks = (tasks || []).filter(t => t.status !== 'completed' && t.status !== 'cancelled')
  const completedTasks = (tasks || []).filter(t => t.status === 'completed')

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tasks</h1>
          <p className="text-slate-500 mt-1">Manage office to-do list and assignments</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Task List */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">Active Tasks</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              <TasksList tasks={incompleteTasks} tenantStaff={tenantStaff || []} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Create Task */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 pb-4">
              <CardTitle className="text-lg">New Task</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <CreateTaskForm tenantStaff={tenantStaff || []} />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
