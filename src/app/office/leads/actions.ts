'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateLead, getLeadById } from '@/modules/leads/server/repository'
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

// KNOWN LIMITATION — flagged deliberately, not to be fixed here:
// This is a hardcoded z.enum of the 5 fixed board stages every tenant
// currently shares. It's correct today because every real transition
// target (the drag-and-drop board, StageControl's manual override, and
// each of the four quick actions in Epics D–G) only ever targets one of
// these fixed stages.
//
// `feature/phase4-custom-column-create-ui` (Epic H) will let tenants
// create their own custom stages, and once it does, this fixed enum will
// reject any transition into a tenant-defined stage — `updateLeadStage`
// will 'Invalid stage' on something that's actually valid for that
// tenant. At that point this needs real rework: validating against the
// tenant's real, dynamic stage list (once a stages table exists) instead
// of a fixed enum. Do not attempt that here — Epic H owns the data model
// this depends on, which doesn't exist yet.
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

  // 5. Fetch the lead pre-change, tenant-scoped. Same cross-tenant guard as
  // before (a lead belonging to another tenant returns null and we stop
  // here, no mutation occurs) — now also doubles as the source of the old
  // stage value, needed below so the real, already-existing activity-log
  // trigger can report a genuine "X → Y" transition instead of "none → Y".
  const { data: leadBeforeChange, error: preFetchError } = await getLeadById(supabase, tenantId, leadId)
  if (preFetchError || !leadBeforeChange) {
    return { success: false, error: 'Lead not found or update failed' }
  }
  const oldStage = leadBeforeChange.stage

  const { data: existingLead, error: fetchError } = await updateLead(
    supabase,
    tenantId,
    leadId,
    { stage: validatedStage }
  )

  if (fetchError || !existingLead) {
    // Could be a race (lead changed/removed between the fetch above and
    // this update) or DB error
    return { success: false, error: 'Lead not found or update failed' }
  }

  // 6. Emit domain event for lead.stage_changed. This already produces a
  // real, visible Activity Timeline entry today — NOT via any application
  // code, but via a real Postgres trigger (trg_activities_consume_events,
  // supabase/migrations/00009 + 00035) that fires AFTER INSERT ON
  // domain_events and idempotently (ON CONFLICT (source_event_id) DO
  // NOTHING) inserts into `activities`, exactly the same mechanism
  // lead.created/lead.updated/task.completed already use. That's the one
  // real shared path — do not add a second, parallel createActivity() call
  // here or anywhere else; the trigger already covers every caller of this
  // function (drag-and-drop, StageControl, and any future quick action)
  // automatically the moment it emits this event.
  //
  // The real, confirmed gap this branch found: the trigger reads
  // `payload->>'old_stage'` to build its "Moved from X to Y" message, but
  // this call never included it — every entry silently said "Moved from
  // none to Y". Adding `old_stage` below is the actual, minimal fix.
  // Non-blocking: if the event emission fails, we do NOT roll back the
  // stage update — the move already happened, logging is a best-effort
  // side effect.
  await emitEvent(supabase, 'lead.stage_changed', 'crm', {
    lead_id: leadId,
    tenant_id: tenantId,
    old_stage: oldStage,
    new_stage: validatedStage,
    changed_by: user.id,
  })

  // 7. Invalidate the Kanban board cache and this lead's detail page (the
  // Activity Timeline lives there and needs the new entry to show up
  // without a manual refresh).
  revalidatePath('/office/leads')
  revalidatePath(`/office/leads/${leadId}`)

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

  const { data: oldLead } = await getLeadById(supabase, tenantId, leadId)
  if (!oldLead) {
    return { success: false, error: 'Lead not found' }
  }

  // 4. Update the lead (tenant-scoped query ensures cross-tenant safety).
  // '' passes Zod's z.string().optional().nullable() fine (it's a valid
  // string) but Postgres's date column rejects it outright (22007) — the
  // form already avoids sending '', but normalize here too since this
  // action shouldn't rely solely on which UI happens to call it.
  const updatePayload = {
    ...parseResult.data,
    preferred_move_date: parseResult.data.preferred_move_date === '' ? null : parseResult.data.preferred_move_date,
  }
  const { data: updatedLead, error: updateError } = await updateLead(
    supabase,
    tenantId,
    leadId,
    updatePayload as any
  )

  if (updateError || !updatedLead) {
    return { success: false, error: 'Lead not found or update failed' }
  }

  const changes: string[] = []
  if (oldLead.preferred_move_date !== updatedLead.preferred_move_date) {
    changes.push(`Move date changed from ${oldLead.preferred_move_date || 'none'} to ${updatedLead.preferred_move_date || 'none'}.`)
  }
  if (oldLead.estimated_volume !== updatedLead.estimated_volume) {
    changes.push(`Estimated volume changed from ${oldLead.estimated_volume || 'none'} to ${updatedLead.estimated_volume || 'none'} cft.`)
  }
  if (oldLead.notes !== updatedLead.notes) {
    changes.push('Internal notes updated.')
  }

  // Emit the lead.updated event so the activity timeline can pick it up
  if (changes.length > 0) {
    await emitEvent(supabase, 'lead.updated', 'crm', {
      lead_id: leadId,
      changes,
    })
  }

  // 5. Invalidate detail page and list
  revalidatePath(`/office/leads/${leadId}`)
  revalidatePath('/office/leads')

  return { success: true, data: updatedLead }
}

export async function createLeadAction(payload: unknown): Promise<{ success: boolean; error?: string; data?: any }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { success: false, error: 'No tenant context' }

  const { insertLeadSchema } = await import('@/modules/leads/schemas')
  const parseResult = insertLeadSchema.safeParse(payload)

  if (!parseResult.success) {
    return { success: false, error: 'Validation failed', data: parseResult.error.issues }
  }

  let brandId = parseResult.data.brand_id
  if (!brandId) {
    const { getDefaultBrandId } = await import('@/modules/settings/brands/server/repository')
    brandId = (await getDefaultBrandId(supabase, tenantId)) ?? undefined
    if (!brandId) return { success: false, error: 'No default brand found for this tenant' }
  }

  const { createLead } = await import('@/modules/leads/server/repository')
  const { data: newLead, error: createError } = await createLead(
    supabase,
    tenantId,
    { ...parseResult.data, brand_id: brandId }
  )

  if (createError || !newLead) {
    return { success: false, error: 'Failed to create lead' }
  }

  // Emit event
  const { emitEvent } = await import('@/utils/supabase/event-bus')
  await emitEvent(supabase, 'lead.created', 'crm', {
    lead_id: newLead.id,
    source: parseResult.data.source || 'manual',
    created_by: user.id
  })

  revalidatePath('/office/leads')
  revalidatePath(`/office/clients/${newLead.contact_id}`)

  return { success: true, data: newLead }
}
