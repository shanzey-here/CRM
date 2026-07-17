'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateLead } from '@/modules/leads/server/repository'
import { emitEvent } from '@/utils/supabase/event-bus'
import { updateLeadDetailsSchema } from '@/modules/leads/schemas'
import { z } from 'zod'

// ============================================================================
// VALIDATED STAGE ENUM
// Gap fix #2: The client sends a stage string from the drag event — we NEVER
// trust it without server-side validation. This Zod enum matches the DB enum
// exactly, and explicitly excludes 'archived' as a drag target since you
// generally cannot drag back out of archived from the kanban board.
// ============================================================================
const ACTIVE_STAGE_VALUES = [
  'inquiry',
  'survey_scheduled',
  'quote_sent',
  'follow_up',
  'confirmed_booking',
] as const

const kanbanStageSchema = z.enum(ACTIVE_STAGE_VALUES)

export type KanbanStage = z.infer<typeof kanbanStageSchema>

export type UpdateLeadStageResult =
  | { success: true }
  | { success: false; error: string }

export async function updateLeadStage(
  leadId: string,
  newStage: unknown // typed as unknown — we validate it, never trust client type assertion
): Promise<UpdateLeadStageResult> {
  // 1. Auth check — must be an authenticated user with a valid tenant
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { success: false, error: 'No tenant context' }
  }

  // 2. Role check — only tenant_admin and dispatcher can move leads
  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // 3. Server-side stage validation — parse & reject before any DB call
  const parseResult = kanbanStageSchema.safeParse(newStage)
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid stage: "${newStage}". Must be one of: ${ACTIVE_STAGE_VALUES.join(', ')}`,
    }
  }
  const validatedStage = parseResult.data

  // 4. Validate the lead UUID shape
  const uuidResult = z.string().uuid().safeParse(leadId)
  if (!uuidResult.success) {
    return { success: false, error: 'Invalid lead ID format' }
  }

  // 5. Fetch the existing lead with tenant scoping before mutating it.
  // This is the cross-tenant guard: if leadId belongs to another tenant,
  // the query returns null and we stop here — no mutation occurs.
  const { data: existingLead, error: fetchError } = await updateLead(
    supabase,
    tenantId,
    leadId,
    { stage: validatedStage }
  )

  if (fetchError || !existingLead) {
    // Could be cross-tenant attempt (lead not found for this tenant) or DB error
    return { success: false, error: 'Lead not found or update failed' }
  }

  // 6. Emit domain event for lead.stage_changed so the future Activities module
  // can consume it retroactively. This matches the lead.created pattern from
  // the public API route and uses the same emit_domain_event RPC function.
  // Non-blocking: if the event emission fails, we do NOT roll back the stage
  // update — the move already happened, logging is a best-effort side effect.
  await emitEvent(supabase, 'lead.stage_changed', 'crm', {
    lead_id: leadId,
    tenant_id: tenantId,
    new_stage: validatedStage,
    changed_by: user.id,
  })

  // 7. Invalidate the Kanban board cache
  revalidatePath('/office/leads')

  return { success: true }
}

export async function updateLeadDetailsAction(
  leadId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; data?: any }> {
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

  // 2. Validate payload against updateLeadDetailsSchema (excludes stage intentionally)
  const parseResult = updateLeadDetailsSchema.safeParse(payload)
  if (!parseResult.success) {
    return { success: false, error: 'Validation failed', data: parseResult.error.issues }
  }

  // 3. Validate lead UUID
  const uuidResult = z.string().uuid().safeParse(leadId)
  if (!uuidResult.success) {
    return { success: false, error: 'Invalid lead ID format' }
  }

  // 4. Update the lead (tenant-scoped query ensures cross-tenant safety)
  const { data: updatedLead, error: updateError } = await updateLead(
    supabase,
    tenantId,
    leadId,
    parseResult.data as any
  )

  if (updateError || !updatedLead) {
    return { success: false, error: 'Lead not found or update failed' }
  }

  // Emit the lead.updated event so the activity timeline can pick it up
  await emitEvent(supabase, 'lead.updated', 'crm', {
    lead_id: leadId,
  })

  // 5. Invalidate detail page and list
  revalidatePath(`/office/leads/${leadId}`)
  revalidatePath('/office/leads')

  return { success: true, data: updatedLead }
}
