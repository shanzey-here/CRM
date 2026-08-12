import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { AnalyticsTabs, type AnalyticsTabKey } from './components/analytics-tabs'
import { RevenueGrowthTab } from './components/revenue-growth-tab'
import { HealthTab } from './components/health-tab'
import { getTenantStatusBreakdown, getPlanDistribution, getGrowthOverTime, getRevenueByPlan, getAllTenants } from '@/modules/platform-analytics/server/repository'
import { computeMrr } from '@/modules/platform-analytics/server/mrr'
import { getTenantEngagement } from '@/modules/platform-health/server/engagement'
import { getChurnRiskData } from '@/modules/platform-health/server/churn'
import { getCronHealth } from '@/modules/platform-health/server/cron-health'

export const dynamic = 'force-dynamic'

// Auth guard lives once in src/app/super-admin/layout.tsx.
export default async function PlatformAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string; tab?: string }>
}) {
  const params = await searchParams
  const months = [3, 6, 12].includes(Number(params.months)) ? Number(params.months) : 12
  const tab: AnalyticsTabKey = params.tab === 'health' ? 'health' : 'revenue'

  const supabase = await createClient()

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Platform Analytics</h1>
        <p className="text-slate-500 mt-1">Cross-tenant revenue, growth, status, and health — real, live data across every workspace.</p>
      </div>

      <AnalyticsTabs activeTab={tab} />

      {tab === 'revenue' ? (
        <RevenueGrowthLoader supabase={supabase} months={months} />
      ) : (
        <HealthTabLoader supabase={supabase} />
      )}
    </div>
  )
}

// Only fetch each tab's real data when that tab is actually being viewed —
// the engagement section alone paginates the entire Auth user list, no
// reason to pay for that on every Revenue & Growth page load.
async function RevenueGrowthLoader({
  supabase,
  months,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  months: number
}) {
  const [statusBreakdown, planDistribution, growthData, revenueByPlan, mrrResult] = await Promise.all([
    getTenantStatusBreakdown(supabase),
    getPlanDistribution(supabase),
    getGrowthOverTime(supabase, months),
    getRevenueByPlan(supabase),
    computeMrr(supabase),
  ])

  return (
    <RevenueGrowthTab
      statusBreakdown={statusBreakdown}
      planDistribution={planDistribution}
      growthData={growthData}
      revenueByPlan={revenueByPlan}
      mrrResult={mrrResult}
      months={months}
    />
  )
}

async function HealthTabLoader({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const tenants = await getAllTenants(supabase)

  // Admin API (listUsers, for real last_sign_in_at) requires service_role —
  // this client is scoped to READ-ONLY use in this feature (see
  // getTenantEngagement's own doc comment). Never add a write call here.
  const serviceClient = createServiceRoleClient()

  const [engagement, churn, cronHealth] = await Promise.all([
    getTenantEngagement(serviceClient, tenants),
    getChurnRiskData(supabase, tenants),
    getCronHealth(supabase),
  ])

  return <HealthTab engagement={engagement} churn={churn} cronHealth={cronHealth} />
}
