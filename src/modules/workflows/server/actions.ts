'use server'

import { createClient } from '@/lib/supabase/server'
import { WorkflowFormSchema, WorkflowFormValues } from '../schemas'
import { isWorkflowModuleEnabled } from './repository'
import { revalidatePath } from 'next/cache'

export async function saveWorkflow(data: WorkflowFormValues, workflowId?: string) {
  const supabase = await createClient()
  
  // 1. Validate Access Control (tenant_admin only)
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.tenant_role
  if (role !== 'tenant_admin') {
    return { error: 'Unauthorized: Only tenant admins can configure workflows' }
  }

  const tenantId = user?.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { error: 'No tenant context found' }
  }

  // 2. Validate Entitlement — the real, unbypassable gate. The builder UI is
  // openly explorable by free-tier tenants (see office/workflows/page.tsx),
  // so this re-check is the only thing actually preventing a free-tier tenant
  // from persisting a real workflow — never trust that the client only got
  // here because the UI allowed it.
  const isEnabled = await isWorkflowModuleEnabled(supabase, tenantId)
  if (!isEnabled) {
    return { error: 'Workflow module is not enabled for your plan', reason: 'entitlement' as const }
  }

  // 3. Validate Payload
  const parsed = WorkflowFormSchema.safeParse(data)
  if (!parsed.success) {
    return { error: 'Invalid form data', issues: parsed.error.issues }
  }
  const payload = parsed.data

  // 4. Map conditions array back to the JSONB flat object expected by the schema
  // For v1, trigger_conditions is a flat JSONB object { "field": "value" }
  const trigger_conditions = payload.trigger_conditions.reduce((acc, condition) => {
    acc[condition.field] = condition.value
    return acc
  }, {} as Record<string, string>)

  // 5. Ensure actions have sort_order mapped correctly based on array index
  const actions = payload.actions.map((action, index) => ({
    ...action,
    sort_order: index
  }))

  // 6. Execute atomic RPC
  const { data: result, error } = await supabase.rpc('save_workflow_transaction', {
    p_tenant_id: tenantId,
    p_workflow_id: workflowId || null,
    p_name: payload.name,
    p_is_active: payload.is_active,
    p_trigger_event_type: payload.trigger_event_type,
    p_trigger_conditions: trigger_conditions,
    p_actions: actions
  })

  if (error) {
    console.error('Error saving workflow:', error)
    return { error: 'Failed to save workflow. Please try again.' }
  }

  revalidatePath('/office/workflows')
  return { success: true, workflowId: result?.id }
}
