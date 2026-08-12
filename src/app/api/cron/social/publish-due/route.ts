import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sweepDuePosts } from '@/modules/social/server/scheduler'
import { logCronRun } from '@/modules/platform-health/server/cron-log'

const JOB_NAME = 'social/publish-due'

// Same shape as src/app/api/cron/mailboxes/sync/route.ts: external
// scheduler hits this on an interval, authenticated via a Bearer
// CRON_SECRET. Fails CLOSED if CRON_SECRET isn't configured — publishing
// to a real external platform on a tenant's behalf is too consequential
// to leave an unauthenticated fallback.
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured — refusing to run' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase service role environment variables' }, { status: 500 })
  }

  const serviceClient = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const startedAt = new Date()

  try {
    const { processed, results } = await sweepDuePosts(serviceClient)
    const flatResults = results.flatMap((r) => r.results)
    const failed = flatResults.filter((r) => !r.ok).length

    await logCronRun(serviceClient, {
      jobName: JOB_NAME,
      startedAt,
      status: failed > 0 ? 'failure' : 'success',
      errorMessage: failed > 0 ? `${failed} of ${flatResults.length} post publish(es) failed` : null,
    })

    return NextResponse.json({ success: true, processed, results })
  } catch (err: any) {
    await logCronRun(serviceClient, { jobName: JOB_NAME, startedAt, status: 'failure', errorMessage: err.message })
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
