import { createClient } from '@/lib/supabase/server'
import { isWorkflowModuleEnabled } from '@/modules/workflows/server/repository'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Workflow, AlertCircle, UserPlus, FileText, Star } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { WORKFLOW_TEMPLATES } from '@/modules/workflows/templates'

export const metadata = {
  title: 'Automation Workflows',
}

export default async function WorkflowsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  if (!tenantId) {
    return <div>No tenant context found</div>
  }

  const isEnabled = await isWorkflowModuleEnabled(supabase, tenantId)

  if (!isEnabled) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Workflow className="mx-auto h-12 w-12 text-slate-400" />
          <h2 className="mt-2 text-lg font-medium text-slate-900">Automation Workflows</h2>
          <p className="mt-1 text-sm text-slate-500">
            Build custom automated rules (e.g. "if a lead is created, assign a task").
          </p>
          <div className="mt-6">
            <div className="inline-flex items-center rounded-md bg-yellow-50 px-3 py-2 text-sm font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
              Not available on your current plan
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { data: workflows, error } = await supabase
    .from('automation_workflows')
    .select('*, automation_workflow_actions(id)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Workflows
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Configure automated actions when events happen in your CRM.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link href="/office/workflows/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Workflow
            </Button>
          </Link>
        </div>
      </div>

      <Alert className="mt-6 bg-slate-50 text-slate-800 border-slate-200">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Workflows are in Preview</AlertTitle>
        <AlertDescription>
          Workflows are currently in configuration-only mode. Activating a workflow will not trigger automated actions until the Workflow Engine is released.
        </AlertDescription>
      </Alert>

      <div className="mt-10 mb-8">
        <h2 className="text-lg font-medium text-slate-900 mb-4">Start from a template</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW_TEMPLATES.map((template) => {
            const Icon = template.icon === 'UserPlus' ? UserPlus : template.icon === 'FileText' ? FileText : Star;
            return (
              <div key={template.id} className="relative flex flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2">
                <div className="flex-1">
                  <div className={`mb-3 inline-flex rounded-lg p-2 ${template.color}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    <Link href={`/office/workflows/new?template=${template.id}`} className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden="true" />
                      {template.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 line-clamp-3">
                    {template.description}
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="text-sm font-medium text-indigo-600 hover:text-indigo-500 flex items-center">
                    Use this template
                    <span aria-hidden="true" className="ml-1">&rarr;</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-8 flow-root">
        <h2 className="text-lg font-medium text-slate-900 mb-4">Your Workflows</h2>
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-slate-300">
                <thead className="bg-slate-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-slate-900 sm:pl-6">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Trigger
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Actions
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-slate-900">
                      Status
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {workflows && workflows.length > 0 ? (
                    workflows.map((workflow) => (
                      <tr key={workflow.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-slate-900 sm:pl-6">
                          {workflow.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                          {workflow.trigger_event_type}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                          {workflow.automation_workflow_actions[0]?.count ?? workflow.automation_workflow_actions.length} action(s)
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-500">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                              workflow.is_active
                                ? 'bg-green-50 text-green-700 ring-green-600/20'
                                : 'bg-slate-50 text-slate-600 ring-slate-500/10'
                            }`}
                          >
                            {workflow.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link href={`/office/workflows/${workflow.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                            Edit<span className="sr-only">, {workflow.name}</span>
                          </Link>
                          <Link href={`/office/workflows/${workflow.id}/logs`} className="text-slate-600 hover:text-slate-900">
                            Logs<span className="sr-only">, {workflow.name}</span>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-slate-500">
                        No workflows created yet. Click "New Workflow" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
