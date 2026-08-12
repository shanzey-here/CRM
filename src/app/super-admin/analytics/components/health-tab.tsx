import { StatTile } from '@/components/ui/stat-tile'
import { EngagementTable } from './engagement-table'
import { AtRiskTable } from './at-risk-table'
import { CronHealthSection } from './cron-health-section'
import type { EngagementResult } from '@/modules/platform-health/server/engagement'
import type { ChurnResult } from '@/modules/platform-health/server/churn'
import type { CronJobHealth } from '@/modules/platform-health/server/cron-health'

function formatPercent(rate: number | null): string {
  if (rate === null) return 'N/A'
  return `${Math.round(rate * 100)}%`
}

export function HealthTab({
  engagement,
  churn,
  cronHealth,
}: {
  engagement: EngagementResult
  churn: ChurnResult
  cronHealth: CronJobHealth[]
}) {
  return (
    <div className="space-y-10">
      {/* Engagement */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Engagement</h2>
        <p className="text-sm text-slate-500 mb-4">
          Based on real Supabase Auth sign-in timestamps — the most recent login by anyone at each tenant.
        </p>
        <div className="mb-6">
          <StatTile
            label={`Active tenants (signed in within ${engagement.activeWindowDays} days)`}
            value={`${engagement.activeTenantCount} / ${engagement.totalTenantCount}`}
            accentClassName="text-emerald-600"
          />
        </div>
        <EngagementTable tenants={engagement.tenants} />
      </section>

      {/* Churn / retention risk */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Churn &amp; retention risk</h2>
        <p className="text-sm text-slate-500 mb-4">
          Flagged by objective, named criteria only — never a black-box score.
        </p>
        <div className="mb-6 max-w-sm">
          <StatTile
            label={`Trial conversion rate (last ${churn.trialConversion.windowDays} days)`}
            value={formatPercent(churn.trialConversion.rate)}
            caption={
              churn.trialConversion.concluded === 0
                ? `No trials concluded in this window — nothing to compute a real rate from.`
                : `${churn.trialConversion.converted} converted of ${churn.trialConversion.concluded} concluded trials.`
            }
            accentClassName={churn.trialConversion.rate === null ? 'text-slate-400' : 'text-[var(--color-primary)]'}
          />
        </div>
        <AtRiskTable tenants={churn.atRiskTenants} />
      </section>

      {/* System health */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Cron health</h2>
        <p className="text-sm text-slate-500 mb-4">
          Last run status per scheduled job, checked against each job&apos;s real vercel.json schedule.
        </p>
        <CronHealthSection jobs={cronHealth} />
      </section>
    </div>
  )
}
