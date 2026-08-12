import type { CronJobHealth } from '@/modules/platform-health/server/cron-health'

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Red is reserved for genuine alerts on this page (outline-only, never
// filled — matches billing-panel.tsx's real suspended/error styling:
// bg-red-50 border-red-200 text-red-700).
export function CronHealthSection({ jobs }: { jobs: CronJobHealth[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {jobs.map((job) => {
        const alarmed = job.isOverdue || job.lastRun?.status === 'failure'
        return (
          <div
            key={job.jobName}
            className={`rounded-lg border p-4 ${alarmed ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200 shadow-sm'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-slate-900">{job.label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{job.scheduleDescription}</p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${
                  alarmed
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {job.isOverdue ? 'Overdue' : job.lastRun?.status === 'failure' ? 'Failed' : 'Healthy'}
              </span>
            </div>

            {job.lastRun ? (
              <div className="mt-3 text-sm">
                <p className="text-slate-600">
                  Last run: <span className="text-slate-900">{formatTimestamp(job.lastRun.completedAt)}</span>
                </p>
                {job.lastRun.status === 'failure' && job.lastRun.errorMessage && (
                  <p className="mt-1 text-red-700 text-xs break-words">{job.lastRun.errorMessage}</p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400 italic">No runs logged yet.</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
