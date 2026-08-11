import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

type Client = SupabaseClient<Database>

export type TenantStatusKey = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled'

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
