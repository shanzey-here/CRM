import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { getTenantEntitlements } from '@/modules/subscriptions/server/entitlements'
import { emitEvent } from '@/utils/supabase/event-bus'

// Same two-gate pattern as isSocialModuleEnabled/isWorkflowModuleEnabled —
// built for a future UI branch to call; not enforced inside the CRUD
// helpers below, matching precedent (social-db's equivalent gate wasn't
// enforced inside its own CRUD helpers either).
export async function isStorageModuleEnabled(supabase: SupabaseClient<Database>, tenantId: string): Promise<boolean> {
  const { data: moduleSettings } = await supabase
    .from('tenant_modules')
    .select('enabled')
    .eq('tenant_id', tenantId)
    .eq('module_key', 'storage_crate_tracking')
    .maybeSingle()

  if (moduleSettings) {
    return moduleSettings.enabled
  }

  const entitlements = await getTenantEntitlements(supabase, tenantId)
  return entitlements['storage_crate_tracking'] === true
}

type StorageUnit = Database['public']['Tables']['storage_units']['Row']
type Crate = Database['public']['Tables']['crates']['Row']
type CrateStatus = Database['public']['Enums']['crate_status']

export async function createStorageUnit(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: { unitNumber: string; capacityCubicFeet: number; locationNotes?: string | null }
) {
  return supabase
    .from('storage_units')
    .insert({
      tenant_id: tenantId,
      unit_number: input.unitNumber,
      capacity_cubic_feet: input.capacityCubicFeet,
      location_notes: input.locationNotes ?? null,
    })
    .select()
    .single()
}

export async function createCrate(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  input: { crateNumber: string; storageUnitId?: string | null; contactId?: string | null; jobId?: string | null }
) {
  return supabase
    .from('crates')
    .insert({
      tenant_id: tenantId,
      crate_number: input.crateNumber,
      storage_unit_id: input.storageUnitId ?? null,
      contact_id: input.contactId ?? null,
      job_id: input.jobId ?? null,
    })
    .select()
    .single()
}

// Mirrors the lead.stage_changed precedent (src/app/office/leads/actions.ts)
// exactly — read the current value, update, then emit a domain event with
// the old/new values. emitEvent() synchronously invokes the workflow
// engine for every event; 'crate.status_changed' isn't a member of
// workflow_trigger_event_type, so any tenant with Workflows enabled gets
// one harmless logged-and-swallowed engine error (executeWorkflows and
// emitEvent both guarantee they never throw back to the caller) — this
// function still completes and returns normally.
export async function updateCrateStatus(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  crateId: string,
  newStatus: CrateStatus,
  changedBy?: string
): Promise<{ data: Crate | null; error: Error | null }> {
  const { data: current, error: readErr } = await supabase
    .from('crates')
    .select('status')
    .eq('id', crateId)
    .eq('tenant_id', tenantId)
    .single()

  if (readErr || !current) {
    return { data: null, error: readErr ?? new Error('Crate not found') }
  }

  // Entering in_warehouse means the crate is fully available again —
  // whether it got there via returned or a cancelled reservation, any
  // rental association left on the row would be stale and would mislead
  // a warehouse operator into thinking it's still linked to a customer.
  // Cleared here, as one side effect of the single real update path, so
  // every caller of this function gets correct behavior, not just the UI.
  // Deliberately NOT applied to lost/damaged — knowing who had the crate
  // when it was lost or damaged is real audit/liability info worth keeping.
  const clearAssociations =
    newStatus === 'in_warehouse'
      ? { contact_id: null, job_id: null, rented_since: null, expected_return_date: null }
      : {}

  const { data: updated, error: updateErr } = await supabase
    .from('crates')
    .update({ status: newStatus, ...clearAssociations })
    .eq('id', crateId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (updateErr || !updated) {
    return { data: null, error: updateErr }
  }

  // No explicit tenantId override here — matches the proven
  // lead.stage_changed call (src/app/office/leads/actions.ts) exactly.
  // emit_domain_event's RPC (00007_phase1_leads_fix_emit_domain_event.sql)
  // rejects an explicit p_tenant_id from any non-service_role caller
  // ("p_tenant_id override is only permitted for service_role callers") —
  // a real, correct guard against a regular user claiming an arbitrary
  // tenant. This function is called from a real authenticated Server
  // Action (changeCrateStatusAction), so it must let the RPC derive the
  // tenant from the caller's own session via current_tenant_id(), the
  // same way every other authenticated-user event emission in this
  // project already does. Discovered empirically: an earlier version of
  // this function passed tenantId explicitly and silently failed to emit
  // any event when called from the real UI (it had only ever been
  // exercised against a service-role client before this branch's testing).
  await emitEvent(supabase, 'crate.status_changed', 'storage', {
    crate_id: crateId,
    tenant_id: tenantId,
    old_status: current.status,
    new_status: newStatus,
    changed_by: changedBy ?? null,
  })

  return { data: updated, error: null }
}

export async function getStorageUnit(supabase: SupabaseClient<Database>, tenantId: string, id: string): Promise<StorageUnit | null> {
  const { data } = await supabase.from('storage_units').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  return data
}

export async function getCrate(supabase: SupabaseClient<Database>, tenantId: string, id: string): Promise<Crate | null> {
  const { data } = await supabase.from('crates').select('*').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  return data
}

export async function listStorageUnits(supabase: SupabaseClient<Database>, tenantId: string): Promise<StorageUnit[]> {
  const { data } = await supabase.from('storage_units').select('*').eq('tenant_id', tenantId).order('unit_number', { ascending: true })
  return data ?? []
}

export async function updateStorageUnit(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  id: string,
  input: { unitNumber?: string; capacityCubicFeet?: number; isAvailable?: boolean; locationNotes?: string | null }
) {
  return supabase
    .from('storage_units')
    .update({
      ...(input.unitNumber !== undefined ? { unit_number: input.unitNumber } : {}),
      ...(input.capacityCubicFeet !== undefined ? { capacity_cubic_feet: input.capacityCubicFeet } : {}),
      ...(input.isAvailable !== undefined ? { is_available: input.isAvailable } : {}),
      ...(input.locationNotes !== undefined ? { location_notes: input.locationNotes } : {}),
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()
}

export async function listCrates(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  filter?: { status?: CrateStatus }
): Promise<Crate[]> {
  let query = supabase.from('crates').select('*').eq('tenant_id', tenantId)
  if (filter?.status) {
    query = query.eq('status', filter.status)
  }
  const { data } = await query.order('crate_number', { ascending: true })
  return data ?? []
}

// Reassigning a storage unit or linking/unlinking a contact/job is NOT a
// status change — it's a plain tenant-scoped update, deliberately not
// routed through updateCrateStatus() (which exists specifically to pair a
// status change with its domain event).
export async function updateCrateAssociations(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  crateId: string,
  input: { storageUnitId?: string | null; contactId?: string | null; jobId?: string | null }
) {
  return supabase
    .from('crates')
    .update({
      ...(input.storageUnitId !== undefined ? { storage_unit_id: input.storageUnitId } : {}),
      ...(input.contactId !== undefined ? { contact_id: input.contactId } : {}),
      ...(input.jobId !== undefined ? { job_id: input.jobId } : {}),
    })
    .eq('id', crateId)
    .eq('tenant_id', tenantId)
    .select()
    .single()
}

export type CrateStatusHistoryEntry = {
  id: string
  old_status: string | null
  new_status: string | null
  changed_by: string | null
  occurred_at: string
}

// New query shape for this project — domain_events has never been filtered
// by a jsonb payload field before. Verified empirically (not just assumed
// from PostgREST docs) that `payload->>crate_id` works as a column-filter
// path against the real DB before relying on it here.
export async function getCrateStatusHistory(supabase: SupabaseClient<Database>, tenantId: string, crateId: string): Promise<CrateStatusHistoryEntry[]> {
  const { data } = await supabase
    .from('domain_events')
    .select('id, payload, occurred_at')
    .eq('tenant_id', tenantId)
    .eq('event_type', 'crate.status_changed')
    .eq('payload->>crate_id', crateId)
    .order('occurred_at', { ascending: false })

  return (data ?? []).map((row) => {
    const payload = row.payload as Record<string, any>
    return {
      id: row.id,
      old_status: payload?.old_status ?? null,
      new_status: payload?.new_status ?? null,
      changed_by: payload?.changed_by ?? null,
      occurred_at: row.occurred_at,
    }
  })
}

type CrateCharge = Database['public']['Tables']['crate_charges']['Row']

export async function getCrateCharges(supabase: SupabaseClient<Database>, tenantId: string, crateId: string): Promise<CrateCharge[]> {
  const { data } = await supabase
    .from('crate_charges')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('crate_id', crateId)
    .order('created_at', { ascending: false })
  return data ?? []
}

// Tenant-wide visibility into ongoing/repeated billing failures — a
// persistently-declining card would otherwise silently generate a new
// failed/requires_action row every day with nothing surfacing it beyond
// opening that one crate's detail page. Cheap filtered view, same spirit
// as the auto-sent-log/workflow-execution-log giving visibility into an
// otherwise per-record, unattended process.
export async function listCratesWithBillingIssues(supabase: SupabaseClient<Database>, tenantId: string): Promise<Crate[]> {
  const { data: issues } = await supabase
    .from('crate_charges')
    .select('crate_id')
    .eq('tenant_id', tenantId)
    .in('status', ['failed', 'requires_action'])

  const crateIds = [...new Set((issues ?? []).map((i) => i.crate_id))]
  if (crateIds.length === 0) return []

  const { data: crates } = await supabase.from('crates').select('*').eq('tenant_id', tenantId).in('id', crateIds).order('crate_number', { ascending: true })
  return crates ?? []
}
