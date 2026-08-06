'use server'

import { createClient } from '@/lib/supabase/server'
import { updateJob, getJobById } from '@/modules/jobs/server/repository'
import { updateJobDetailsSchema, UpdateJobDetailsInput } from '@/modules/jobs/schema'
import { generateAndSaveJobCompletionSummary } from '@/modules/jobs/server/completion-summary'
import { revalidatePath } from 'next/cache'

export async function updateJobDetailsAction(jobId: string, payload: UpdateJobDetailsInput) {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { success: false, error: 'No tenant context' }
  }

  // 2. Role check — matches the existing dispatcher/tenant_admin precedent for
  // Lead detail editing (updateLeadDetailsAction). /office is already gated
  // to these two roles at the layout level; this is defense in depth.
  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // 3. Validate payload — never trust client shape
  const parseResult = updateJobDetailsSchema.safeParse(payload)
  if (!parseResult.success) {
    return { success: false, error: 'Validation failed', issues: parseResult.error.flatten() }
  }

  // 4. Update (tenant-scoped query ensures cross-tenant safety)
  const result = await updateJob(supabase, tenantId, jobId, parseResult.data)
  if (!result.success) {
    return { success: false, error: result.error ?? 'Failed to update job' }
  }

  // 5. Revalidate
  revalidatePath(`/office/jobs/${jobId}`)
  revalidatePath('/office/jobs')

  return { success: true, data: result.job }
}

// Manual recovery path for when the automatic generation (hooked into the
// real crew sign-off flow) failed or was skipped. Only meaningful for a job
// that's actually completed — regenerating for an in-progress job would
// compile a summary from an unfinished state.
export async function regenerateJobCompletionSummaryAction(jobId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { success: false, error: 'No tenant context' }
  }

  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    return { success: false, error: 'Insufficient permissions' }
  }

  const jobResult = await getJobById(supabase, tenantId, jobId)
  if (!jobResult.success || !jobResult.job) {
    return { success: false, error: 'Job not found' }
  }
  if (jobResult.job.status !== 'completed') {
    return { success: false, error: 'Job is not marked completed yet — nothing to summarize.' }
  }

  try {
    const result = await generateAndSaveJobCompletionSummary(supabase, tenantId, jobId)
    if (!result.success) {
      return { success: false, error: result.error }
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate completion summary' }
  }

  revalidatePath(`/office/jobs/${jobId}`)
  return { success: true }
}
