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

  const { data: updated, error: updateErr } = await supabase
    .from('crates')
    .update({ status: newStatus })
    .eq('id', crateId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (updateErr || !updated) {
    return { data: null, error: updateErr }
  }

  await emitEvent(
    supabase,
    'crate.status_changed',
    'storage',
    {
      crate_id: crateId,
      tenant_id: tenantId,
      old_status: current.status,
      new_status: newStatus,
      changed_by: changedBy ?? null,
    },
    tenantId
  )

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
