import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { computeMrr } from '@/modules/platform-analytics/server/mrr'

// Same shape as src/app/api/cron/crates/bill-overdue/route.ts: external
// scheduler hits this once daily, authenticated via a Bearer CRON_SECRET.
// Fails CLOSED if CRON_SECRET isn't configured.
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

  // The exact same calculation the Analytics page's MRR stat tile uses —
  // never a second, parallel calculation that could drift out of sync.
  const { mrr, activeTenantCount } = await computeMrr(serviceClient)

  const snapshotDate = new Date().toISOString().slice(0, 10)

  const { data, error } = await serviceClient
    .from('platform_mrr_snapshots')
    .upsert(
      { snapshot_date: snapshotDate, mrr, active_tenant_count: activeTenantCount },
      { onConflict: 'snapshot_date' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, snapshot: data })
}
