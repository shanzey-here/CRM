import { createClient } from '@/lib/supabase/server'
import { WorkflowBuilderForm } from './WorkflowBuilderForm'
import { notFound } from 'next/navigation'
import { WorkflowFormValues } from '@/modules/workflows/schemas'
import { WORKFLOW_TEMPLATES } from '@/modules/workflows/templates'

export default async function WorkflowEditorPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ template?: string }> }) {
  const { id } = await params
  const { template } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user?.app_metadata?.tenant_id as string | undefined

  if (!tenantId) return <div>No tenant</div>

  // Fetch AI setting
  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('ai_quoting_mode')
    .eq('tenant_id', tenantId)
    .single()
  
  const isAiEmailEnabled = settings?.ai_quoting_mode && settings.ai_quoting_mode !== 'off'

  let initialData: (WorkflowFormValues & { id: string }) | undefined = undefined

  if (id === 'new') {
    if (template) {
      const selectedTemplate = WORKFLOW_TEMPLATES.find(t => t.id === template)
      if (selectedTemplate) {
        initialData = {
          id: 'new',
          ...selectedTemplate.config
        }
      }
    }
  } else {
    const { data: workflow, error } = await supabase
      .from('automation_workflows')
      .select('*, automation_workflow_actions(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !workflow) {
      notFound()
    }

    // Convert flat JSON object `{ field: value }` back to array `[{ field, value }]`
    const conditionsObject = workflow.trigger_conditions as Record<string, string>
    const conditionsArray = Object.entries(conditionsObject || {}).map(([field, value]) => ({ field, value }))

    // Ensure actions are sorted correctly
    const sortedActions = [...workflow.automation_workflow_actions].sort((a, b) => a.sort_order - b.sort_order)

    initialData = {
      id: workflow.id,
      name: workflow.name,
      is_active: workflow.is_active,
      trigger_event_type: workflow.trigger_event_type as any,
      trigger_conditions: conditionsArray,
      actions: sortedActions.map(a => ({
        action_type: a.action_type as any,
        action_config: a.action_config as any
      }))
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold leading-7 text-slate-900 sm:truncate sm:text-3xl sm:tracking-tight">
          {id === 'new' ? 'Create Workflow' : 'Edit Workflow'}
        </h1>
      </div>
      
      <WorkflowBuilderForm initialData={initialData} isAiEmailEnabled={!!isAiEmailEnabled} />
    </div>
  )
}
