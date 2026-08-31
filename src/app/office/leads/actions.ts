'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateLead, getLeadById } from '@/modules/leads/server/repository'
import { emitEvent } from '@/utils/supabase/event-bus'
import {
  updateLeadDetailsSchema,
  followUpFormSchema,
  confirmBookingFormSchema,
  createCustomStageSchema,
  type PipelineStageDef,
  type CreateCustomStageInput,
} from '@/modules/leads/schemas'
import { createActivity } from '@/modules/activities/server/repository'
import { createTask } from '@/modules/tasks/server/repository'
import { createAddress } from '@/modules/clients/server/repository'
import { createManualJobAction } from '@/app/office/jobs/actions'
import { retryStageAdvance } from '@/modules/leads/server/stage-retry'
import { z } from 'zod'

// ============================================================================
// STAGE VALIDATION — now against the tenant's real pipeline_stages rows.
//
// Previously this was a hardcoded z.enum of the 5 board stages, flagged as a
// known limitation to be resolved once a real stages table existed. That table
// (public.pipeline_stages, per-tenant, keyed by `key` = the old lead_stage
// enum value) now exists and leads.stage_id FKs to it
// (20260831140000_leads_stage_id_migration.sql). updateLeadStage() below
// validates the requested stage against that tenant's own rows — a key
// ('quote_sent') or a stage_id (uuid) — so a tenant-defined custom stage is
// accepted and a stage that only exists for a different tenant is rejected.
//
// ACTIVE_STAGE_VALUES / KanbanStage stay as the 5 board-column stage keys —
// still the shape the drag board and StageControl deal in.
// ============================================================================
const ACTIVE_STAGE_VALUES = [
  'inquiry',
  'survey_scheduled',
  'quote_sent',
  'follow_up',
  'confirmed_booking',
] as const

export type KanbanStage = (typeof ACTIVE_STAGE_VALUES)[number]

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

  // 3. Server-side stage validation — against THIS tenant's real
  //    pipeline_stages rows, not a fixed enum. Accepts either a stage `key`
  //    ('quote_sent' — what the board and every current caller pass) or a
  //    `stage_id` uuid. A stage belonging to another tenant resolves to no
  //    row here and is rejected.
  const requestedStage = typeof newStage === 'string' ? newStage.trim() : ''
  if (!requestedStage) {
    return { success: false, error: `Invalid stage: "${String(newStage)}"` }
  }
  const isUuid = z.string().uuid().safeParse(requestedStage).success
  const { data: stageRow } = await supabase
    .from('pipeline_stages')
    .select('id, key, name')
    .eq('tenant_id', tenantId)
    .eq(isUuid ? 'id' : 'key', requestedStage)
    .maybeSingle()

  if (!stageRow) {
    return {
      success: false,
      error: `Invalid stage: "${requestedStage}" is not a pipeline stage for this workspace.`,
    }
  }
  const validatedStage = (stageRow.key ?? stageRow.id) as string

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

  // Write the FK column. The BEFORE trigger (leads_sync_stage_columns) keeps
  // the legacy `stage` enum column in lock-step, so every not-yet-migrated
  // reader of leads.stage stays correct with no inconsistency window.
  const { data: existingLead, error: fetchError } = await updateLead(
    supabase,
    tenantId,
    leadId,
    { stage_id: stageRow.id } as any
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

// ============================================================================
// LOG FOLLOW-UP (Epic F) — the manual "Follow Up" quick action.
// Decision record: PHASE4_FOLLOW_UP_DECISION.md.
//
// One staff-initiated action, three REUSED systems in sequence:
//   1. createActivity()  — the note + contact method, visible on the Activity
//      Timeline (activity_type mapped from the method: phone→call, email→email,
//      text→note).
//   2. createTask()      — only if a reminder date was given. A real `tasks`
//      row (status 'pending', due_date set) so it shows on the Dashboard
//      TasksWidget for free — that widget already reads `tasks`.
//   3. updateLeadStage() — moves the lead to `follow_up`. This ALREADY logs
//      the "Moved from X to Follow Up" timeline entry via the existing
//      domain-event → activities trigger, so we do NOT write a second
//      activity for the transition here.
//
// Not atomic (Supabase has no JS-level multi-table transaction; the sibling
// scheduleSurveyAction has the same shape). Ordered so the note — the point of
// the action — lands first; a later failure surfaces to the user with the note
// already safely recorded, and the stage move is best-effort (mirrors
// scheduleSurveyAction: success:true + a warning string if only the stage
// transition failed).
// ============================================================================
const METHOD_TO_ACTIVITY_TYPE = {
  phone: 'call',
  email: 'email',
  text: 'note',
} as const

export async function logFollowUpAction(
  leadId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return { success: false, error: 'No tenant context' }
  }

  // Same role gate as updateLeadStage — only tenant_admin / dispatcher move leads.
  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    return { success: false, error: 'Insufficient permissions' }
  }

  const uuidResult = z.string().uuid().safeParse(leadId)
  if (!uuidResult.success) {
    return { success: false, error: 'Invalid lead ID format' }
  }

  const parsed = followUpFormSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const { note, contact_method, reminder_date } = parsed.data

  // Tenant-scoped fetch doubles as the cross-tenant guard: a lead from another
  // tenant returns null and nothing below runs.
  const { data: lead, error: leadError } = await getLeadById(supabase, tenantId, leadId)
  if (leadError || !lead) {
    return { success: false, error: 'Lead not found' }
  }

  // 1. The note + contact method → Activity Timeline.
  const { error: activityError } = await createActivity(supabase, tenantId, {
    lead_id: leadId,
    contact_id: lead.contact_id,
    type: METHOD_TO_ACTIVITY_TYPE[contact_method],
    content: `Follow-up (${contact_method}): ${note}`,
    metadata: { kind: 'follow_up', contact_method },
    created_by: user.id,
  })
  if (activityError) {
    return { success: false, error: `Failed to log follow-up note: ${activityError.message}` }
  }

  // 2. Optional reminder → a real pending task (also surfaces on the dashboard).
  if (reminder_date) {
    let contactName = 'lead'
    const { data: contactRow } = await supabase
      .from('contacts')
      .select('first_name, last_name, company_name')
      .eq('tenant_id', tenantId)
      .eq('id', lead.contact_id)
      .maybeSingle()
    if (contactRow) {
      contactName =
        [contactRow.first_name, contactRow.last_name].filter(Boolean).join(' ').trim() ||
        contactRow.company_name ||
        'lead'
    }

    // Date-only → end-of-day ISO so a "due today" reminder isn't already past.
    const dueIso = new Date(`${reminder_date}T17:00:00`).toISOString()

    const { error: taskError } = await createTask(supabase, tenantId, {
      lead_id: leadId,
      contact_id: lead.contact_id,
      title: `Follow up with ${contactName}`,
      description: `Reminder from follow-up logged ${new Date().toLocaleDateString('en-GB')}: ${note}`,
      due_date: dueIso,
      status: 'pending',
      priority: 'medium',
      created_by: user.id,
    })
    if (taskError) {
      // Note is already saved; tell the user the reminder specifically failed
      // so they can retry that part without duplicating the note.
      return {
        success: false,
        error: `Follow-up note saved, but the reminder task failed: ${taskError.message}`,
      }
    }
  }

  // 3. Advance the stage via the canonical shared transition function.
  const stageResult = await updateLeadStage(leadId, 'follow_up')

  revalidatePath('/office/leads')
  revalidatePath(`/office/leads/${leadId}`)
  revalidatePath('/office') // dashboard TasksWidget

  if (!stageResult.success) {
    return {
      success: true,
      warning: `Follow-up logged, but the stage transition failed: ${stageResult.error}`,
    }
  }

  return { success: true }
}

// ============================================================================
// CONFIRM BOOKING (Epic G) — the manual "Confirm Booking" quick action.
// Decision record: PHASE4_CONFIRM_BOOKING_DECISION.md (incl. § 2A).
//
// For a booking closed OUTSIDE the online proposal flow. Full conversion:
//   1. Resolve origin/destination address ids — pass the lead's through when
//      set, otherwise create `addresses` rows from inline city/postcode via
//      the shared createAddress() (same pattern as create-client-form).
//   2. createManualJobAction() — THE SHARED job path (→ create_manual_job_
//      transaction: real `jobs` row + draft invoice). Not forked here.
//   3. updateLeadStage(leadId, 'confirmed_booking') — the RPC does not touch
//      `leads`. Per § 2A: one retry, but re-read the stage first and skip the
//      retry if it is already `confirmed_booking` (avoids a duplicate
//      "confirmed_booking → confirmed_booking" timeline entry in the
//      lost-response edge case).
//   4. If the retry also fails: return success (the job/invoice genuinely
//      exist) with a SPECIFIC warning naming the job — never roll back.
// ============================================================================
export async function confirmBookingAction(
  leadId: string,
  payload: unknown
): Promise<{ success: boolean; error?: string; jobId?: string; warning?: string }> {
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

  const uuidResult = z.string().uuid().safeParse(leadId)
  if (!uuidResult.success) {
    return { success: false, error: 'Invalid lead ID format' }
  }

  const parsed = confirmBookingFormSchema.safeParse(payload)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const f = parsed.data

  // Tenant-scoped fetch = cross-tenant guard + the real lead data we pre-fill from.
  const { data: lead, error: leadError } = await getLeadById(supabase, tenantId, leadId)
  if (leadError || !lead) {
    return { success: false, error: 'Lead not found' }
  }

  // 1. Resolve addresses. On-file ids pass straight through; otherwise the
  //    inline city+postcode become mandatory (this is the "addresses up front"
  //    rule from the decision record — enforced here, authoritatively).
  //    New rows are created via the shared createAddress() (line_1 '-' — the
  //    same shape create-client-form uses).
  let originAddressId = lead.origin_address_id ?? null
  if (!originAddressId) {
    if (!f.origin_city || !f.origin_postcode) {
      return { success: false, error: 'A pickup city and postcode are required (the lead has no address on file).' }
    }
    const { data: addr, error } = await createAddress(supabase, tenantId, {
      line_1: '-',
      city: f.origin_city,
      postcode: f.origin_postcode,
      country: 'GB',
    })
    if (error || !addr) {
      return { success: false, error: `Failed to save the pickup address: ${error?.message ?? 'unknown error'}` }
    }
    originAddressId = addr.id
  }

  let destinationAddressId = lead.destination_address_id ?? null
  if (!destinationAddressId) {
    if (!f.destination_city || !f.destination_postcode) {
      return { success: false, error: 'A delivery city and postcode are required (the lead has no address on file).' }
    }
    const { data: addr, error } = await createAddress(supabase, tenantId, {
      line_1: '-',
      city: f.destination_city,
      postcode: f.destination_postcode,
      country: 'GB',
    })
    if (error || !addr) {
      return { success: false, error: `Failed to save the delivery address: ${error?.message ?? 'unknown error'}` }
    }
    destinationAddressId = addr.id
  }

  // 2. Create the real job + draft invoice via the SHARED action. No new path.
  const jobResult = await createManualJobAction({
    contact_id: lead.contact_id,
    brand_id: lead.brand_id,
    title: f.title,
    move_date: f.move_date,
    origin_address_id: originAddressId,
    destination_address_id: destinationAddressId,
    line_items: [{ description: f.line_item_description, quantity: 1, unit_price: f.agreed_price }],
    assigned_crew: [],
    assigned_vehicles: [],
  })

  if (!jobResult.success || !jobResult.jobId) {
    return { success: false, error: jobResult.error || 'Failed to create the job' }
  }
  const jobId = jobResult.jobId

  // 3. Advance the lead stage — canonical shared function; the RPC did NOT.
  //    § 2A: one retry, skipping if the stage is already correct.
  const { result: stageResult } = await retryStageAdvance({
    target: 'confirmed_booking' as const,
    attempt: () => updateLeadStage(leadId, 'confirmed_booking'),
    currentStage: async () => (await getLeadById(supabase, tenantId, leadId)).data?.stage,
  })

  revalidatePath('/office/leads')
  revalidatePath(`/office/leads/${leadId}`)
  revalidatePath('/office/jobs')
  revalidatePath('/office/scheduling')

  // 4. § 2A: job exists regardless — surface a specific, non-error warning.
  if (!stageResult.success) {
    return {
      success: true,
      jobId,
      warning: `Job and draft invoice created (Job #${jobId.slice(0, 8)}), but the lead's stage could not be updated automatically — move it to Confirmed Booking manually.`,
    }
  }

  return { success: true, jobId }
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

// ============================================================================
// CREATE CUSTOM STAGE COLUMN (Epic H)
// ============================================================================
export type CreateCustomColumnResult =
  | { success: true; data: PipelineStageDef }
  | { success: false; error: string }

export async function createCustomColumnAction(
  rawInput: unknown
): Promise<CreateCustomColumnResult> {
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

  // 2. Role check — tenant_admin and dispatcher only
  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // 3. Schema validation
  const parseResult = createCustomStageSchema.safeParse(rawInput)
  if (!parseResult.success) {
    const issue = parseResult.error.issues[0]?.message ?? 'Validation failed'
    return { success: false, error: issue }
  }

  const { name, color } = parseResult.data

  // 4. Case-insensitive name uniqueness check for this tenant
  const { data: existing } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', name)
    .maybeSingle()

  if (existing) {
    return { success: false, error: `A pipeline stage named "${name}" already exists.` }
  }

  // 5. Calculate position (appended after highest position)
  const { data: highestPositionStage } = await supabase
    .from('pipeline_stages')
    .select('position')
    .eq('tenant_id', tenantId)
    .order('position', { ascending: false })
    .limit(1)

  const nextPosition = (highestPositionStage?.[0]?.position ?? 0) + 1

  // 6. Insert new custom stage
  const { data: newStage, error: insertError } = await supabase
    .from('pipeline_stages')
    .insert({
      tenant_id: tenantId,
      name,
      color: color || '#64748b',
      position: nextPosition,
      is_system: false,
      is_hidden_by_default: false,
      key: null,
    })
    .select('id, key, name, color, position, is_system, is_hidden_by_default')
    .single()

  if (insertError || !newStage) {
    if (insertError?.code === '23505') {
      return { success: false, error: `A pipeline stage named "${name}" already exists.` }
    }
    return { success: false, error: insertError?.message ?? 'Failed to create stage column' }
  }

  revalidatePath('/office/leads')

  return { success: true, data: newStage as PipelineStageDef }
}

// ============================================================================
// REORDER PIPELINE STAGE COLUMNS (Epic H)
// ============================================================================
export type ReorderPipelineStagesResult =
  | { success: true }
  | { success: false; error: string }

export async function reorderPipelineStagesAction(
  orderedStageIds: unknown
): Promise<ReorderPipelineStagesResult> {
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

  // 2. Role check — tenant_admin and dispatcher only
  const role = user.app_metadata?.tenant_role ?? user.app_metadata?.role
  if (role !== 'tenant_admin' && role !== 'dispatcher') {
    return { success: false, error: 'Insufficient permissions' }
  }

  // 3. Validate input schema
  const schema = z.array(z.string().uuid()).min(1, 'At least one stage ID is required')
  const parseResult = schema.safeParse(orderedStageIds)
  if (!parseResult.success) {
    return { success: false, error: 'Invalid stage IDs format' }
  }

  const stageIds = parseResult.data

  // 4. Verify all stages belong to this tenant (strict tenant isolation)
  const { data: ownedStages, error: fetchError } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('id', stageIds)

  if (fetchError || !ownedStages || ownedStages.length !== stageIds.length) {
    return {
      success: false,
      error: 'One or more stages were not found in this workspace',
    }
  }

  // 5. Update positions sequentially (1, 2, 3...)
  const updatePromises = stageIds.map((stageId, index) =>
    supabase
      .from('pipeline_stages')
      .update({ position: index + 1 })
      .eq('id', stageId)
      .eq('tenant_id', tenantId)
  )

  const results = await Promise.all(updatePromises)
  const failedResult = results.find((r) => r.error)
  if (failedResult?.error) {
    return {
      success: false,
      error: failedResult.error.message || 'Failed to update stage order',
    }
  }

  // 6. Invalidate leads page cache
  revalidatePath('/office/leads')

  return { success: true }
}

