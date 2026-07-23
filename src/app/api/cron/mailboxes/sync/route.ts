import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { runMailboxSync } from '@/modules/mailboxes/server/sync'

// Same shape as the trial-expiry cron (src/app/api/cron/trials/expire/route.ts):
// external scheduler (Vercel Cron or similar) hits this on an interval,
// authenticated via a Bearer CRON_SECRET. Unlike that route, this one FAILS
// CLOSED if CRON_SECRET isn't configured — mailbox credentials are too
// sensitive to leave an unauthenticated fallback.
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

  const result = await runMailboxSync(serviceClient)

  if (result.skipped) {
    return NextResponse.json({ success: true, skipped: true, reason: result.reason })
  }

  return NextResponse.json({
    success: true,
    skipped: false,
    processed: result.results.length,
    succeeded: result.results.filter((r) => r.ok).length,
    failed: result.results.filter((r) => !r.ok).length,
    results: result.results,
  })
}
