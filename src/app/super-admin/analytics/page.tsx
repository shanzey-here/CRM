import { createClient } from '@/lib/supabase/server'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusDonut } from './components/status-donut'
import { HorizontalBarChart } from './components/horizontal-bar-chart'
import { GrowthCharts } from './components/growth-charts'
import { GrowthRangeToggle } from './components/growth-range-toggle'
import { getTenantStatusBreakdown, getPlanDistribution, getGrowthOverTime, getRevenueByPlan } from '@/modules/platform-analytics/server/repository'
import { computeMrr } from '@/modules/platform-analytics/server/mrr'
import { COUNT_COLOR, REVENUE_COLOR } from '@/modules/platform-analytics/colors'

export const dynamic = 'force-dynamic'

function formatGBP(n: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n)
}

// Auth guard lives once in src/app/super-admin/layout.tsx.
export default async function PlatformAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string }>
}) {
  const params = await searchParams
  const months = [3, 6, 12].includes(Number(params.months)) ? Number(params.months) : 12

  const supabase = await createClient()

  const [statusBreakdown, planDistribution, growthData, revenueByPlan, mrrResult] = await Promise.all([
    getTenantStatusBreakdown(supabase),
    getPlanDistribution(supabase),
    getGrowthOverTime(supabase, months),
    getRevenueByPlan(supabase),
    computeMrr(supabase),
  ])

  const { totalTenants, totalSubscriptionRows, countsByStatus } = statusBreakdown
  const planCountTotal = planDistribution.reduce((sum, p) => sum + p.tenantCount, 0)
  const revenueTotal = revenueByPlan.reduce((sum, p) => sum + p.revenue, 0)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Analytics</h1>
        <p className="text-slate-500 mt-1">Cross-tenant revenue, growth, and status — real, live data across every workspace.</p>
      </div>

      {totalTenants !== totalSubscriptionRows && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          Data consistency warning: {totalTenants} tenants but {totalSubscriptionRows} subscription rows — every tenant should have exactly one. Investigate before trusting the breakdown below.
        </div>
      )}

      {/* 2a. Tenant status breakdown */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Tenants</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <StatTile label="Total tenants" value={String(totalTenants)} />
          <StatTile label="Active" value={String(countsByStatus.active)} accentClassName="text-emerald-600" />
          <StatTile label="Trialing" value={String(countsByStatus.trialing)} accentClassName="text-[var(--color-primary)]" />
          <StatTile label="Suspended" value={String(countsByStatus.suspended + countsByStatus.cancelled)} accentClassName="text-slate-500" />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <StatusDonut countsByStatus={countsByStatus} />
        </div>
      </section>

      {/* 2b. Plan distribution */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Plan distribution</h2>
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <HorizontalBarChart
            data={planDistribution.map((p) => ({ name: p.planName, value: p.tenantCount, total: planCountTotal }))}
            color={COUNT_COLOR}
            format="count"
            emptyLabel="No tenants on a plan yet."
          />
        </div>
      </section>

      {/* 2c. Growth over time */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Growth</h2>
          <GrowthRangeToggle activeMonths={months} />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <GrowthCharts data={growthData} />
        </div>
      </section>

      {/* 2d. Revenue */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Revenue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
          <div className="sm:col-span-2">
            <StatTile
              label="Monthly Recurring Revenue (MRR)"
              value={formatGBP(mrrResult.mrr)}
              caption={`Active, successfully-billing subscriptions only (${mrrResult.activeTenantCount} tenants) — trialing, past_due, suspended, and cancelled are excluded.`}
              size="large"
              accentClassName="text-emerald-600"
            />
          </div>
          <StatTile
            label="At risk"
            value={formatGBP(mrrResult.atRisk)}
            caption={`Payment retry in progress (${mrrResult.pastDueTenantCount} tenants) — not included in MRR above.`}
            accentClassName="text-amber-600"
          />
        </div>
        <p className="text-xs text-slate-400 mb-6">
          Daily MRR snapshots started with this release — a trend chart will follow once enough history has accumulated.
        </p>

        <h3 className="text-sm font-medium text-slate-700 mb-3">Revenue by plan</h3>
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <HorizontalBarChart
            data={revenueByPlan.map((p) => ({ name: p.planName, value: p.revenue, total: revenueTotal }))}
            color={REVENUE_COLOR}
            format="currency-gbp"
            emptyLabel="No active, paying tenants yet."
          />
        </div>
      </section>
    </div>
  )
}
