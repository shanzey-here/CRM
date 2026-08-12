import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export type CronJobDefinition = {
  jobName: string
  label: string
  scheduleDescription: string
  expectedIntervalMinutes: number
}

// Mirrors the real, live vercel.json — the single source of truth for
// actual cron schedules. If vercel.json ever changes, this must change too;
// no separate schedule config exists anywhere else.
export const CRON_JOBS: CronJobDefinition[] = [
  { jobName: 'analytics/snapshot-mrr', label: 'MRR snapshot', scheduleDescription: 'Daily at 01:00 UTC', expectedIntervalMinutes: 24 * 60 },
  { jobName: 'crates/bill-overdue', label: 'Crate overdue billing', scheduleDescription: 'Daily at 03:00 UTC', expectedIntervalMinutes: 24 * 60 },
  { jobName: 'trials/expire', label: 'Trial expiry sweep', scheduleDescription: 'Daily at 04:00 UTC', expectedIntervalMinutes: 24 * 60 },
  { jobName: 'mailboxes/sync', label: 'Mailbox sync', scheduleDescription: 'Every 10 minutes', expectedIntervalMinutes: 10 },
  { jobName: 'social/publish-due', label: 'Social publish', scheduleDescription: 'Every 15 minutes', expectedIntervalMinutes: 15 },
]

export type CronJobHealth = CronJobDefinition & {
  lastRun: { completedAt: string; status: 'success' | 'failure'; errorMessage: string | null } | null
  isOverdue: boolean
}

// Generous grace multiplier on top of the expected interval before flagging
// a job overdue — avoids false alarms from ordinary scheduling jitter.
const OVERDUE_GRACE_MULTIPLIER = 3

export async function getCronHealth(supabase: SupabaseClient<Database>): Promise<CronJobHealth[]> {
  const { data, error } = await supabase
    .from('cron_run_log')
    .select('job_name, completed_at, status, error_message')
    .order('completed_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch cron_run_log: ${error.message}`)

  const latestByJob = new Map<string, { completedAt: string; status: 'success' | 'failure'; errorMessage: string | null }>()
  for (const row of data ?? []) {
    if (!latestByJob.has(row.job_name)) {
      latestByJob.set(row.job_name, {
        completedAt: row.completed_at,
        status: row.status as 'success' | 'failure',
        errorMessage: row.error_message,
      })
    }
  }

  const now = Date.now()
  return CRON_JOBS.map((job) => {
    const lastRun = latestByJob.get(job.jobName) ?? null
    const overdueThresholdMs = job.expectedIntervalMinutes * 60 * 1000 * OVERDUE_GRACE_MULTIPLIER
    const isOverdue = !lastRun || now - new Date(lastRun.completedAt).getTime() > overdueThresholdMs
    return { ...job, lastRun, isOverdue }
  })
}
