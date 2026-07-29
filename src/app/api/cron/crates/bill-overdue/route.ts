import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sweepCrateBilling } from '@/modules/storage/server/billing'

// Same shape as src/app/api/cron/mailboxes/sync/route.ts: external
// scheduler hits this once daily, authenticated via a Bearer CRON_SECRET.
// Fails CLOSED if CRON_SECRET isn't configured — this route creates real
// charges against real customers, too consequential to leave an
// unauthenticated fallback.
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

  const { processed, results } = await sweepCrateBilling(serviceClient)

  return NextResponse.json({
    success: true,
    processed,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
}
