'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createStorageUnitSchema, updateStorageUnitSchema, createCrateSchema } from '@/modules/storage/schemas'
import {
  createStorageUnit,
  updateStorageUnit,
  createCrate,
  updateCrateStatus,
  updateCrateAssociations,
} from '@/modules/storage/server/repository'
import { isValidCrateTransition, ALL_CRATE_STATUSES, CrateStatus } from '@/modules/storage/transitions'

type OfficeStaffGuard =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; tenantId: string; userId: string }

async function requireOfficeStaff(): Promise<OfficeStaffGuard> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'Unauthorized' }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  const tenantRole = user.app_metadata?.tenant_role

  if (!tenantId) return { error: 'No tenant context' }

  // tenant_admin AND dispatcher — operational warehouse data, matching the
  // access level already set at the RLS layer in storage-db.
  if (tenantRole !== 'tenant_admin' && tenantRole !== 'dispatcher') {
    return { error: 'Forbidden' }
  }

  return { supabase, tenantId, userId: user.id }
}

export type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string }

export async function createStorageUnitAction(formData: FormData): Promise<ActionResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const parsed = createStorageUnitSchema.safeParse({
    unitNumber: formData.get('unitNumber'),
    capacityCubicFeet: formData.get('capacityCubicFeet'),
    locationNotes: formData.get('locationNotes') || undefined,
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { error } = await createStorageUnit(supabase, tenantId, parsed.data)
  if (error) return { success: false, error: error.message }

  revalidatePath('/office/storage/units')
  return { success: true }
}

export async function updateStorageUnitAction(id: string, formData: FormData): Promise<ActionResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const isAvailableRaw = formData.get('isAvailable')
  const parsed = updateStorageUnitSchema.safeParse({
    unitNumber: formData.get('unitNumber') || undefined,
    capacityCubicFeet: formData.get('capacityCubicFeet') || undefined,
    isAvailable: isAvailableRaw === null ? undefined : isAvailableRaw === 'true',
    locationNotes: formData.get('locationNotes') ?? undefined,
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { error } = await updateStorageUnit(supabase, tenantId, id, parsed.data)
  if (error) return { success: false, error: error.message }

  revalidatePath('/office/storage/units')
  return { success: true }
}

export async function createCrateAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const storageUnitIdRaw = formData.get('storageUnitId')
  const parsed = createCrateSchema.safeParse({
    crateNumber: formData.get('crateNumber'),
    storageUnitId: storageUnitIdRaw || undefined,
  })
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  // Every new crate starts in_warehouse — there's no status field on the
  // create form at all, so there's no way to create a crate already
  // lost/reserved/etc. through the UI.
  const { data, error } = await createCrate(supabase, tenantId, {
    crateNumber: parsed.data.crateNumber,
    storageUnitId: parsed.data.storageUnitId ?? null,
  })
  if (error || !data) return { success: false, error: error?.message ?? 'Failed to create crate' }

  revalidatePath('/office/storage')
  return { success: true, data: { id: data.id } }
}

// The transition-map-guarded wrapper around the real updateCrateStatus()
// repository function — never a raw .update() on crates.status. The
// dropdown in crate-status-control.tsx already only offers valid next
// states, but this re-checks server-side as defense-in-depth against a
// bypassed/forged request (same discipline as composePostSchema being
// re-validated server-side).
export async function changeCrateStatusAction(crateId: string, newStatus: string, allowOverride = false): Promise<ActionResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId, userId } = guard

  if (!ALL_CRATE_STATUSES.includes(newStatus as CrateStatus)) {
    return { success: false, error: 'Invalid status value' }
  }

  const { getCrate } = await import('@/modules/storage/server/repository')
  const crate = await getCrate(supabase, tenantId, crateId)
  if (!crate) return { success: false, error: 'Crate not found' }

  if (!allowOverride && !isValidCrateTransition(crate.status, newStatus as CrateStatus)) {
    return { success: false, error: `Cannot change status from "${crate.status}" to "${newStatus}" — that's not a valid transition.` }
  }

  const { error } = await updateCrateStatus(supabase, tenantId, crateId, newStatus as CrateStatus, userId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/office/storage/crates/${crateId}`)
  revalidatePath('/office/storage')
  return { success: true }
}

export async function reassignCrateStorageUnitAction(crateId: string, storageUnitId: string | null): Promise<ActionResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const { error } = await updateCrateAssociations(supabase, tenantId, crateId, { storageUnitId })
  if (error) return { success: false, error: error.message }

  revalidatePath(`/office/storage/crates/${crateId}`)
  return { success: true }
}

export async function linkCrateAction(crateId: string, { contactId, jobId }: { contactId?: string | null; jobId?: string | null }): Promise<ActionResult> {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { success: false, error: guard.error }
  const { supabase, tenantId } = guard

  const { error } = await updateCrateAssociations(supabase, tenantId, crateId, {
    ...(contactId !== undefined ? { contactId } : {}),
    ...(jobId !== undefined ? { jobId } : {}),
  })
  if (error) return { success: false, error: error.message }

  revalidatePath(`/office/storage/crates/${crateId}`)
  return { success: true }
}

export async function searchContactsAndJobsAction(query: string) {
  const guard = await requireOfficeStaff()
  if ('error' in guard) return { contacts: [], jobs: [] }
  const { supabase, tenantId } = guard

  if (!query.trim() || query.trim().length < 2) return { contacts: [], jobs: [] }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email')
    .eq('tenant_id', tenantId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(8)

  // Same !inner-join pattern as searchContactsAndLeadsAction
  // (src/app/office/email/[threadId]/actions.ts) — forces an inner join so
  // the embedded contacts columns are filterable via {foreignTable: 'contacts'}.
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, move_date, contacts!inner ( first_name, last_name )')
    .eq('tenant_id', tenantId)
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`, { foreignTable: 'contacts' })
    .limit(8)

  return { contacts: contacts ?? [], jobs: jobs ?? [] }
}
