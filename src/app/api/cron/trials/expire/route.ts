import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sweepExpiredTrials, notifyApproachingTrials } from '@/modules/subscriptions/server/trial-sweep'
import { logCronRun } from '@/modules/platform-health/server/cron-log'

const JOB_NAME = 'trials/expire'

// Authenticated via Bearer CRON_SECRET, matching the project-wide convention
// established in src/app/api/cron/mailboxes/sync/route.ts and
// src/app/api/cron/crates/bill-overdue/route.ts.
//
// SECURITY: Fails CLOSED — if CRON_SECRET is not configured this route
// refuses to run entirely.  The previous behaviour (failing open when the env
// var was unset) was a genuine security gap: any unauthenticated caller could
// trigger trial transitions across all tenants.
//
// LOCAL DEV: no real cron runs locally; trigger manually with:
//   curl -s -H "Authorization: Bearer <CRON_SECRET>" \
//        http://localhost:3000/api/cron/trials/expire | jq .
export async function GET(request: Request) {
  // --- Auth (fail CLOSED) ---
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured — refusing to run' },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Supabase service-role client ---
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Missing Supabase service role environment variables' },
      { status: 500 }
    )
  }

  const serviceClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const startedAt = new Date()

  try {
    // 1. Transition expired trials → suspended
    const expiredResult = await sweepExpiredTrials(serviceClient)

    // 2. Notify trials approaching expiry (error-isolated per tenant inside
    //    notifyApproachingTrials — a failure here never breaks step 1)
    const notifyResult = await notifyApproachingTrials(serviceClient)

    await logCronRun(serviceClient, { jobName: JOB_NAME, startedAt, status: 'success' })

    return NextResponse.json({
      success: true,
      expired: {
        processed: expiredResult.processed,
        tenantIds: expiredResult.tenantIds,
      },
      notifications: {
        notified: notifyResult.notified,
        skipped: notifyResult.skipped,
        errors: notifyResult.errors,
      },
    })
  } catch (err: any) {
    console.error('[CRON] Trial sweep error:', err)
    await logCronRun(serviceClient, { jobName: JOB_NAME, startedAt, status: 'failure', errorMessage: err.message })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
