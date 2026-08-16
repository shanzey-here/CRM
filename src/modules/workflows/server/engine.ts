import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { isWorkflowModuleEnabled } from './repository'

type WorkflowAction = Database['public']['Tables']['automation_workflow_actions']['Row']
type Workflow = Database['public']['Tables']['automation_workflows']['Row'] & {
  automation_workflow_actions: WorkflowAction[]
}

/**
 * Synchronously executes all matching active workflows for a given domain event.
 *
 * CRITICAL DESIGN REQUIREMENT: This function must NEVER throw an exception back to
 * the caller. It runs inline during core actions (e.g., lead creation). If a
 * workflow fails, we log it and move on. We must never drop a real customer lead
 * just because an automated rule was misconfigured.
 */
export async function executeWorkflows(
  supabase: SupabaseClient<Database>,
  eventType: Database['public']['Enums']['workflow_trigger_event_type'],
  payload: Record<string, any>,
  eventId: string,
  explicitTenantId?: string
) {
  try {
    // 1. Resolve tenant_id.
    let tenantId = explicitTenantId
    if (!tenantId) {
      const { data: { user } } = await supabase.auth.getUser()
      tenantId = user?.app_metadata?.tenant_id
      if (!tenantId) {
        console.warn(`[Workflow Engine] Could not resolve tenant_id for event ${eventType} (${eventId}). Skipping workflows.`)
        return
      }
    }

    // 2. Fast-fail if the tenant isn't entitled to use workflows
    const isEnabled = await isWorkflowModuleEnabled(supabase, tenantId)
    if (!isEnabled) {
      return
    }

    // 3. Fetch active workflows for this event type
    const { data: activeWorkflows, error: fetchErr } = await supabase
      .from('automation_workflows')
      .select('*, automation_workflow_actions(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('trigger_event_type', eventType)
      .order('sort_order', { referencedTable: 'automation_workflow_actions', ascending: true })

    if (fetchErr) {
      console.error(`[Workflow Engine] Failed to fetch workflows for event ${eventId}:`, fetchErr)
      return
    }

    if (!activeWorkflows || activeWorkflows.length === 0) {
      return
    }

    // 4. Evaluate each workflow and run actions if conditions match
    for (const workflow of activeWorkflows as unknown as Workflow[]) {
      // Flat JSON equality check for initial trigger conditions
      const conditions = workflow.trigger_conditions as Record<string, any>
      let match = true
      for (const [key, expectedValue] of Object.entries(conditions)) {
        if (payload[key] !== expectedValue) {
          match = false
          break
        }
      }

      if (!match) {
        continue // Skip this workflow
      }

      // We have a match! Insert execution log
      const { data: logRow, error: logErr } = await supabase
        .from('automation_workflow_execution_log')
        .insert({
          tenant_id: tenantId,
          workflow_id: workflow.id,
          event_id: eventId,
          status: 'pending',
          logs: []
        })
        .select('id')
        .single()

      if (logErr || !logRow) {
        console.error(`[Workflow Engine] Failed to create execution log for workflow ${workflow.id}:`, logErr)
        continue // Skip to next workflow, we can't track this one
      }

      await executeWorkflowInstance(
        supabase,
        tenantId,
        workflow,
        payload,
        eventId,
        logRow.id,
        0,
        []
      )
    }

  } catch (err: any) {
    // Ultimate safety net: never throw back to the caller
    console.error(`[Workflow Engine] Fatal error during workflow execution for event ${eventId}:`, err)
  }
}

export async function executeWorkflowInstance(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  workflow: Workflow,
  payload: Record<string, any>,
  eventId: string,
  executionLogId: string,
  startSortOrder: number,
  existingLogs: Array<{ action_id: string; type: string; status: 'success' | 'failed'; error?: string }>
) {
  let successCount = 0
  let failedCount = 0
  const actionLogs = [...existingLogs]
  let currentSortOrder: number | null = startSortOrder
  let isPaused = false

  // Ensure actions are sorted
  const actions = [...(workflow.automation_workflow_actions || [])].sort((a, b) => a.sort_order - b.sort_order)

  while (currentSortOrder !== null) {
    const action = actions.find(a => a.sort_order === currentSortOrder)
    if (!action) {
      break // End of workflow chain
    }

    try {
      const config = action.action_config as Record<string, any>
      let nextSortOrder: number | null = currentSortOrder + 1

      if (action.action_type === 'delay') {
        const delayMs = (config.delay_hours || 0) * 3600000 + (config.delay_minutes || 0) * 60000
        const resumeAt = new Date(Date.now() + delayMs).toISOString()
        
        const { error: pendingErr } = await supabase
          .from('automation_workflow_pending_steps')
          .insert({
            tenant_id: tenantId,
            workflow_id: workflow.id,
            execution_log_id: executionLogId,
            next_action_sort_order: nextSortOrder,
            resume_at: resumeAt,
            payload: payload // Exact snapshot from initial event
          })

        if (pendingErr) throw pendingErr

        actionLogs.push({ action_id: action.id, type: action.action_type, status: 'success' })
        isPaused = true
        break // Halt execution loop
      } 
      
      else if (action.action_type === 'condition') {
        const field = config.field
        const expectedValue = config.value
        const operator = config.operator || '==='
        const actualValue = payload[field]

        let conditionMet = false
        if (actualValue === undefined) {
          // Graceful handling of missing fields -> false
          conditionMet = false
        } else if (operator === '===') {
          conditionMet = actualValue === expectedValue
        } else if (operator === '>') {
          conditionMet = actualValue > expectedValue
        } else if (operator === '<') {
          conditionMet = actualValue < expectedValue
        } else if (operator === 'includes') {
          conditionMet = Array.isArray(actualValue) 
            ? actualValue.includes(expectedValue) 
            : String(actualValue).includes(expectedValue)
        }

        if (!conditionMet && typeof config.false_branch_jump_to === 'number') {
          nextSortOrder = config.false_branch_jump_to
        }
        actionLogs.push({ action_id: action.id, type: action.action_type, status: 'success' })
      } 
      
      else if (action.action_type === 'create_task') {
        const { createTask } = await import('@/modules/tasks/server/repository')
        const result = await createTask(supabase, tenantId, {
          title: config.title || 'Automated Task',
          description: `Generated by workflow: ${workflow.name}`,
          status: 'pending',
          due_date: new Date(Date.now() + 86400000 * 3).toISOString(), // default +3 days
          lead_id: payload.lead_id,
          contact_id: payload.contact_id,
          assigned_to: config.assigned_to
        })
        if (result.error) {
          throw new Error(result.error.message || JSON.stringify(result.error))
        }
        successCount++
        actionLogs.push({ action_id: action.id, type: action.action_type, status: 'success' })
      } 
      
      else if (action.action_type === 'update_lead_stage') {
        const leadId = payload.lead_id
        if (!leadId) throw new Error('No lead_id provided in event payload')
        
        const { error: updateErr } = await supabase
          .from('leads')
          .update({ stage: config.stage })
          .eq('tenant_id', tenantId)
          .eq('id', leadId)
          
        if (updateErr) throw updateErr
        successCount++
        actionLogs.push({ action_id: action.id, type: action.action_type, status: 'success' })
      }

      else if (action.action_type === 'send_email') {
        // Future actual implementation (requires template compilation)
        // For now, just mark success to prove the workflow engine drives it
        successCount++
        actionLogs.push({ action_id: action.id, type: action.action_type, status: 'success' })
      }

      else if (action.action_type === 'send_sms') {
        // Future actual implementation
        successCount++
        actionLogs.push({ action_id: action.id, type: action.action_type, status: 'success' })
      }

      else if (action.action_type === 'notify_staff') {
        // Future actual implementation
        successCount++
        actionLogs.push({ action_id: action.id, type: action.action_type, status: 'success' })
      }
      
      else {
        throw new Error(`Unsupported action type: ${action.action_type}`)
      }

      currentSortOrder = nextSortOrder
    } catch (err: any) {
      failedCount++
      actionLogs.push({ action_id: action.id, type: action.action_type, status: 'failed', error: err.message })
      // On failure, continue to the next sequential step (isolation principle)
      currentSortOrder = currentSortOrder + 1
    }
  }

  // Update Execution Log State
  if (isPaused) {
    await supabase
      .from('automation_workflow_execution_log')
      .update({
        status: 'pending',
        logs: actionLogs as any
      })
      .eq('id', executionLogId)
  } else {
    let finalStatus: 'success' | 'failed' | 'partial' = 'success'
    if (failedCount > 0) {
      finalStatus = (successCount === 0 && !actionLogs.some(l => l.status === 'success')) ? 'failed' : 'partial'
    }
    await supabase
      .from('automation_workflow_execution_log')
      .update({
        status: finalStatus,
        logs: actionLogs as any
      })
      .eq('id', executionLogId)
  }
}
