import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export const metadata = {
  title: 'Workflow Execution Log',
}

export default async function WorkflowLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  if (!tenantId) return <div>No tenant context found</div>

  const { data: workflow, error } = await supabase
    .from('automation_workflows')
    .select('name')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !workflow) {
    notFound()
  }

  // Fetch logs (which will be legitimately empty for now)
  const { data: logs } = await supabase
    .from('automation_workflow_execution_log')
    .select('*')
    .eq('workflow_id', id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center space-x-4">
        <Link href="/office/workflows">
          <Button
            variant="outline"
            size="icon"
            title="Back to workflows"
            aria-label="Back to workflows"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Logs: {workflow.name}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            View execution history and errors for this workflow.
          </p>
        </div>
      </div>


      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        {logs && logs.length > 0 ? (
          <ul role="list" className="divide-y divide-slate-200">
            {logs.map((log) => (
              <li key={log.id} className="p-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <p className="truncate text-sm font-medium text-blue-600">Event #{log.event_id}</p>
                    <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                      {log.status}
                    </span>
                  </div>
                  <div className="ml-2 flex flex-shrink-0">
                    <p className="text-sm text-slate-500">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-16">
            <Clock className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-2 text-sm font-semibold text-slate-900">No execution logs</h3>
            <p className="mt-1 text-sm text-slate-500">
              This workflow hasn't executed yet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
