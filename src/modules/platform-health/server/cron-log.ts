import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

// The single shared logger every cron route calls — reuse this, never build
// a bespoke logger per route.
export async function logCronRun(
  serviceClient: SupabaseClient<Database>,
  params: { jobName: string; startedAt: Date; status: 'success' | 'failure'; errorMessage?: string | null }
): Promise<void> {
  const { error } = await serviceClient.from('cron_run_log').insert({
    job_name: params.jobName,
    started_at: params.startedAt.toISOString(),
    status: params.status,
    error_message: params.errorMessage ?? null,
  })
  if (error) {
    // A logging failure must never surface as the cron route's own failure —
    // matches this app's established emitEvent() convention: a secondary
    // observability write is best-effort and never blocks the primary action.
    console.error(`[cron-log] Failed to log run for '${params.jobName}':`, error.message)
  }
}
