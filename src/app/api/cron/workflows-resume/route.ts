import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { logCronRun } from '@/modules/platform-health/server/cron-log'
import { executeWorkflowInstance } from '@/modules/workflows/server/engine'
import { Database } from '@/types/database.types'

const JOB_NAME = 'workflows/resume'

export async function GET(request: Request) {
  // --- Auth (fail CLOSED) ---
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured — refusing to run' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Supabase service-role client ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Missing Supabase service role environment variables' },
      { status: 500 }
    )
  }

  const serviceClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const startedAt = new Date()
  let processed = 0
  let errors = 0

  try {
    // 1. Fetch pending steps that are ready to resume
    const { data: pendingSteps, error: fetchErr } = await serviceClient
      .from('automation_workflow_pending_steps')
      .select('*, automation_workflows(*, automation_workflow_actions(*)), automation_workflow_execution_log(*)')
      .lte('resume_at', new Date().toISOString())
      .limit(100) // Batch processing to avoid timeouts

    if (fetchErr) {
      throw new Error(`Failed to fetch pending steps: ${fetchErr.message}`)
    }

    if (pendingSteps && pendingSteps.length > 0) {
      for (const step of pendingSteps) {
        try {
          // Immediately delete the pending step to prevent duplicate processing if engine fails midway
          await serviceClient
            .from('automation_workflow_pending_steps')
            .delete()
            .eq('id', step.id)

          const workflow = step.automation_workflows
          if (!workflow || !step.automation_workflow_execution_log) continue

          const existingLogs = (step.automation_workflow_execution_log.logs as any) || []

          // Resume workflow instance using the exact snapshot payload
          await executeWorkflowInstance(
            serviceClient,
            step.tenant_id,
            workflow as any,
            step.payload as Record<string, any>,
            step.automation_workflow_execution_log.event_id,
            step.execution_log_id,
            step.next_action_sort_order,
            existingLogs
          )

          processed++
        } catch (stepErr: any) {
          console.error(`[CRON] Error resuming workflow step ${step.id}:`, stepErr)
          errors++
        }
      }
    }

    await logCronRun(serviceClient, { jobName: JOB_NAME, startedAt, status: 'success' })

    return NextResponse.json({
      success: true,
      processed,
      errors
    })
  } catch (err: any) {
    console.error('[CRON] Workflow resume error:', err)
    await logCronRun(serviceClient, { jobName: JOB_NAME, startedAt, status: 'failure', errorMessage: err.message })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
