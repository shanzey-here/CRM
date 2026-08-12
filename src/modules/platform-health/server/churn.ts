import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export type AtRiskTenant = {
  tenantId: string
  tenantName: string
  // Every reason is a plain, named sentence — never a black-box score.
  reasons: string[]
}

export type TrialConversion = {
  windowDays: number
  concluded: number
  converted: number
  // null (not 0) when concluded === 0 — this app never estimates or
  // fabricates a rate from zero real data.
  rate: number | null
}

export type ChurnResult = {
  atRiskTenants: AtRiskTenant[]
  trialConversion: TrialConversion
}

const AT_RISK_PAST_DUE_DAYS = 7
const REPEATED_CYCLE_WINDOW_DAYS = 90
const REPEATED_CYCLE_THRESHOLD = 2
const CONVERSION_WINDOW_DAYS = 90

type StatusTransition = {
  tenant_id: string
  old_status: string | null
  new_status: string
  changed_at: string
}

// Reuses the exact status/tenant_id/timestamp history the narrow
// get_tenant_status_transitions() RPC exposes (audit.logs, wrapped and
// scoped — see its migration for why it can't be queried directly).
export async function getChurnRiskData(
  supabase: SupabaseClient<Database>,
  tenants: { id: string; name: string }[]
): Promise<ChurnResult> {
  const tenantNameById = new Map(tenants.map((t) => [t.id, t.name]))
  const liveTenantIds = new Set(tenants.map((t) => t.id))
  const now = Date.now()

  // --- Criterion 1: currently past_due for N+ days (real column, no RPC needed) ---
  const { data: subs, error: subsErr } = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id, past_due_since')
    .eq('status', 'past_due')
  if (subsErr) throw new Error(`Failed to fetch past_due subscriptions: ${subsErr.message}`)

  const reasonsByTenant = new Map<string, string[]>()
  function addReason(tenantId: string, reason: string) {
    const arr = reasonsByTenant.get(tenantId) ?? []
    arr.push(reason)
    reasonsByTenant.set(tenantId, arr)
  }

  for (const s of subs ?? []) {
    if (!s.past_due_since || !liveTenantIds.has(s.tenant_id)) continue
    const days = Math.floor((now - new Date(s.past_due_since).getTime()) / (1000 * 60 * 60 * 24))
    if (days >= AT_RISK_PAST_DUE_DAYS) {
      addReason(s.tenant_id, `past_due for ${days} days`)
    }
  }

  // --- Fetch real status-transition history once, shared by criterion 2 and trial conversion ---
  const { data: transitions, error: rpcErr } = await supabase.rpc('get_tenant_status_transitions')
  if (rpcErr) throw new Error(`Failed to fetch status transitions: ${rpcErr.message}`)
  const allTransitions = (transitions ?? []) as StatusTransition[]

  // --- Criterion 2: repeated past_due cycles within the last 90 days ---
  const cycleWindowStart = now - REPEATED_CYCLE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const pastDueEntriesByTenant = new Map<string, number>()
  for (const t of allTransitions) {
    if (
      t.new_status === 'past_due' &&
      t.old_status !== 'past_due' &&
      new Date(t.changed_at).getTime() >= cycleWindowStart
    ) {
      pastDueEntriesByTenant.set(t.tenant_id, (pastDueEntriesByTenant.get(t.tenant_id) ?? 0) + 1)
    }
  }
  for (const [tenantId, count] of pastDueEntriesByTenant) {
    if (count >= REPEATED_CYCLE_THRESHOLD && liveTenantIds.has(tenantId)) {
      addReason(tenantId, `${count} past_due cycles in the last ${REPEATED_CYCLE_WINDOW_DAYS} days`)
    }
  }

  const atRiskTenants: AtRiskTenant[] = Array.from(reasonsByTenant.entries()).map(([tenantId, reasons]) => ({
    tenantId,
    tenantName: tenantNameById.get(tenantId) ?? 'Unknown tenant',
    reasons,
  }))

  // --- Trial conversion rate ---
  // "Concluded" = a tenant whose very first tenant_subscriptions row was
  // 'trialing', and who has since either reached 'active' at least once
  // (converted) or is now cancelled/suspended having never been active
  // (churned without converting) — bucketed by when that conclusion
  // happened, within the last CONVERSION_WINDOW_DAYS.
  const historyByTenant = new Map<string, StatusTransition[]>()
  for (const t of allTransitions) {
    if (!liveTenantIds.has(t.tenant_id)) continue
    const arr = historyByTenant.get(t.tenant_id) ?? []
    arr.push(t)
    historyByTenant.set(t.tenant_id, arr)
  }

  const conversionWindowStart = now - CONVERSION_WINDOW_DAYS * 24 * 60 * 60 * 1000
  let concluded = 0
  let converted = 0

  for (const history of historyByTenant.values()) {
    const sorted = [...history].sort((a, b) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
    const first = sorted[0]
    if (!first || first.new_status !== 'trialing') continue // didn't start as a trial

    const firstActive = sorted.find((h) => h.new_status === 'active')
    const latest = sorted[sorted.length - 1]

    if (firstActive) {
      if (new Date(firstActive.changed_at).getTime() >= conversionWindowStart) {
        concluded++
        converted++
      }
    } else if (latest.new_status === 'cancelled' || latest.new_status === 'suspended') {
      if (new Date(latest.changed_at).getTime() >= conversionWindowStart) {
        concluded++
      }
    }
    // else: still trialing/past_due with no resolution yet — not concluded, excluded
  }

  return {
    atRiskTenants,
    trialConversion: {
      windowDays: CONVERSION_WINDOW_DAYS,
      concluded,
      converted,
      rate: concluded > 0 ? converted / concluded : null,
    },
  }
}
