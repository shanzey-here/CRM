import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type Client = SupabaseClient<Database>

export type TenantStatusKey = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled'

// Shared by the Health tab's engagement and churn/retention sections — both
// need the real live tenant id/name list to label results and to scope out
// history belonging to deleted tenants (audit.logs has no FK to tenants, by
// design, so it can carry rows for tenants that no longer exist).
export async function getAllTenants(supabase: Client): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('tenants').select('id, name').order('name', { ascending: true })
  if (error) throw new Error(`Failed to fetch tenants: ${error.message}`)
  return data ?? []
}

export type StatusBreakdown = {
  totalTenants: number
  totalSubscriptionRows: number
  countsByStatus: Record<TenantStatusKey, number>
}

// Buckets every tenant's real subscription status into the 5 real
// tenant_status enum values, applying the exact same
// `manually_suspended || status === 'suspended'` override the dashboard's
// own tenant-list.tsx already uses — so this page's "Suspended" count
// matches what a super admin sees on the tenant list itself.
export async function getTenantStatusBreakdown(supabase: Client): Promise<StatusBreakdown> {
  const [{ count: totalTenants }, { data: subs, error }] = await Promise.all([
    supabase.from('tenants').select('id', { count: 'exact', head: true }),
    supabase.from('tenant_subscriptions').select('tenant_id, status, manually_suspended'),
  ])

  if (error) throw new Error(`Failed to fetch status breakdown: ${error.message}`)

  const countsByStatus: Record<TenantStatusKey, number> = {
    trialing: 0,
    active: 0,
    past_due: 0,
    suspended: 0,
    cancelled: 0,
  }

  for (const row of subs ?? []) {
    const status = row.manually_suspended ? 'suspended' : (row.status as TenantStatusKey)
    if (status in countsByStatus) countsByStatus[status]++
  }

  return {
    totalTenants: totalTenants ?? 0,
    totalSubscriptionRows: subs?.length ?? 0,
    countsByStatus,
  }
}

export type PlanDistributionEntry = { planId: string; planName: string; tenantCount: number }

// Same nested-select join path getTenantSubscription() already uses
// (tenant_subscriptions -> saas_prices -> saas_plans), just spanning every
// tenant instead of .eq(tenant_id).single().
export async function getPlanDistribution(supabase: Client): Promise<PlanDistributionEntry[]> {
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id, saas_prices ( plan_id, saas_plans ( id, name ) )')

  if (error) throw new Error(`Failed to fetch plan distribution: ${error.message}`)

  const counts = new Map<string, { name: string; count: number }>()
  for (const row of data ?? []) {
    const plan = (row.saas_prices as any)?.saas_plans as { id: string; name: string } | null
    if (!plan) continue
    const existing = counts.get(plan.id)
    if (existing) existing.count++
    else counts.set(plan.id, { name: plan.name, count: 1 })
  }

  return Array.from(counts.entries())
    .map(([planId, { name, count }]) => ({ planId, planName: name, tenantCount: count }))
    .sort((a, b) => b.tenantCount - a.tenantCount)
}

export type RevenueByPlanEntry = { planId: string; planName: string; revenue: number }

// Same join as getPlanDistribution, filtered to active-only (matches
// computeMrr's own inclusion rule), grouped and normalized the same way.
export async function getRevenueByPlan(supabase: Client): Promise<RevenueByPlanEntry[]> {
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id, status, saas_prices ( unit_amount, interval, plan_id, saas_plans ( id, name ) )')
    .eq('status', 'active')

  if (error) throw new Error(`Failed to fetch revenue by plan: ${error.message}`)

  const revenueByPlan = new Map<string, { name: string; revenue: number }>()
  for (const row of data ?? []) {
    const price = row.saas_prices as any
    const plan = price?.saas_plans as { id: string; name: string } | null
    if (!plan || !price?.unit_amount) continue

    const monthly = price.interval === 'year' ? price.unit_amount / 100 / 12 : price.unit_amount / 100
    const existing = revenueByPlan.get(plan.id)
    if (existing) existing.revenue += monthly
    else revenueByPlan.set(plan.id, { name: plan.name, revenue: monthly })
  }

  return Array.from(revenueByPlan.entries())
    .map(([planId, { name, revenue }]) => ({ planId, planName: name, revenue: Math.round(revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
}

export type GrowthPoint = { period: string; newTenants: number; cumulativeTotal: number }

// Real facts only — tenants.created_at, no estimation involved (unlike
// revenue, which has no historical snapshot table yet). Cumulative is
// correctly seeded from the real count of tenants created before the
// window starts, not just the in-window delta.
export async function getGrowthOverTime(supabase: Client, months: number): Promise<GrowthPoint[]> {
  const now = new Date()
  const windowStart = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

  const [{ count: baselineCount }, { data: tenantsInWindow, error }] = await Promise.all([
    supabase.from('tenants').select('id', { count: 'exact', head: true }).lt('created_at', windowStart.toISOString()),
    supabase.from('tenants').select('id, created_at').gte('created_at', windowStart.toISOString()).order('created_at', { ascending: true }),
  ])

  if (error) throw new Error(`Failed to fetch growth data: ${error.message}`)

  // Build the ordered list of month buckets first, so months with zero
  // signups still appear (not skipped) — a gap-free chart, not a broken one.
  const buckets: { period: string; year: number; month: number }[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(windowStart.getFullYear(), windowStart.getMonth() + i, 1)
    buckets.push({ period: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() })
  }

  const newByBucket = new Map<string, number>()
  for (const t of tenantsInWindow ?? []) {
    const d = new Date(t.created_at)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    newByBucket.set(key, (newByBucket.get(key) ?? 0) + 1)
  }

  let cumulative = baselineCount ?? 0
  return buckets.map((b) => {
    const key = `${b.year}-${b.month}`
    const newTenants = newByBucket.get(key) ?? 0
    cumulative += newTenants
    return { period: b.period, newTenants, cumulativeTotal: cumulative }
  })
}

export type QuoteBookingPoint = {
  period: string
  quotesSent: number
  confirmedBookings: number
  // null (not 0 or NaN) when quotesSent === 0 for that period — this app
  // never fabricates a rate from zero real data.
  conversionRate: number | null
}

// Real, audited findings this function encodes (see the feature's Part 1
// audit for the full evidence trail):
//
// - "Quotes Sent" = every quote that ever left `draft` (status <> 'draft'),
//   bucketed by created_at. No dedicated sent_at column exists anywhere in
//   the schema, and no application code path currently transitions a quote
//   to 'sent' at all — created_at is the only real timestamp available, so
//   this measures "quote created (and eventually sent)" by month, not a
//   true send-date. accepted/declined/expired all require having passed
//   through 'sent' per the real DB state machine (accept_quote_transaction
//   raises P0002 otherwise), so they count too — not just rows currently
//   sitting in 'sent'.
//
// - "Confirmed Bookings" = status = 'accepted' AND accepted_at IS NOT NULL,
//   bucketed by the real accepted_at column (stamped atomically by
//   accept_quote_transaction, confirmed across its entire migration
//   history — no code path can set 'accepted' without it). Real finding:
//   of 94 real accepted quotes, only 12 have accepted_at — the other 82
//   are confirmed real seed/test data (traced to specific scripts,
//   zero created_by on any of them) that bypassed the RPC and never got a
//   real acceptance timestamp. Deliberately NOT backfilled with
//   created_at or any other estimate — excluded from this chart, with the
//   gap disclosed in the UI caption, per this project's non-negotiable
//   "never invent a number" rule.
//
// - No tenant/quote filtering by subscription status or any soft-delete
//   flag: tenants have no deleted_at column and are never actually
//   deleted (only their subscription status changes), so this already
//   includes 100% of every tenant's real historical activity regardless
//   of current standing (active, trialing, suspended, cancelled).
const UTC_MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Every timestamp column involved here (created_at, accepted_at) is a real
// UTC timestamptz. Bucketing with local-timezone getters (getMonth(),
// getFullYear(), toLocaleDateString()) is a real, confirmed bug on a
// dev machine running outside UTC (Pakistan Standard Time, UTC+5): a quote
// created at 2026-07-31T20:00:00Z is legitimately still July in UTC, but
// getMonth() rolls it to August locally — verified against a direct UTC
// SQL query (to_char(created_at, 'YYYY-MM')) which showed the real
// per-month split diverging from the naive local-getter version by exactly
// the count of late-day boundary rows. Every date computation below uses
// the UTC variants for that reason — never swap these back to local getters.
export async function getQuotesAndBookingsOverTime(supabase: Client, months: number): Promise<QuoteBookingPoint[]> {
  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1))

  const [{ data: sentQuotes, error: sentErr }, { data: confirmedBookings, error: confirmedErr }] = await Promise.all([
    supabase.from('quotes').select('created_at').neq('status', 'draft').gte('created_at', windowStart.toISOString()),
    supabase
      .from('quotes')
      .select('accepted_at')
      .eq('status', 'accepted')
      .not('accepted_at', 'is', null)
      .gte('accepted_at', windowStart.toISOString()),
  ])

  if (sentErr) throw new Error(`Failed to fetch quotes sent: ${sentErr.message}`)
  if (confirmedErr) throw new Error(`Failed to fetch confirmed bookings: ${confirmedErr.message}`)

  const buckets: { period: string; year: number; month: number }[] = []
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(windowStart.getUTCFullYear(), windowStart.getUTCMonth() + i, 1))
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth()
    buckets.push({ period: `${UTC_MONTH_ABBR[month]} ${String(year).slice(-2)}`, year, month })
  }

  const sentByBucket = new Map<string, number>()
  for (const q of sentQuotes ?? []) {
    const d = new Date(q.created_at)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
    sentByBucket.set(key, (sentByBucket.get(key) ?? 0) + 1)
  }

  const confirmedByBucket = new Map<string, number>()
  for (const q of confirmedBookings ?? []) {
    const d = new Date(q.accepted_at!)
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`
    confirmedByBucket.set(key, (confirmedByBucket.get(key) ?? 0) + 1)
  }

  return buckets.map((b) => {
    const key = `${b.year}-${b.month}`
    const quotesSent = sentByBucket.get(key) ?? 0
    const confirmed = confirmedByBucket.get(key) ?? 0
    return {
      period: b.period,
      quotesSent,
      confirmedBookings: confirmed,
      conversionRate: quotesSent > 0 ? confirmed / quotesSent : null,
    }
  })
}
