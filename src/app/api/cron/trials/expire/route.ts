import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Vercel Cron standardizes on sending a Bearer token matching CRON_SECRET
// For local testing, you can pass ?secret=XYZ or Bearer XYZ
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expectedSecret = process.env.CRON_SECRET

  if (
    expectedSecret &&
    authHeader !== `Bearer ${expectedSecret}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing Supabase service role environment variables' }, { status: 500 })
  }

  // Use service_role client to bypass RLS and perform cross-tenant operations
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 1. Identify all expired trials
    // Note: To remain idempotent and efficient, we strictly filter `status = 'trialing'`
    // The `now()` comparison requires using raw RPC or fetching & updating if we can't do it cleanly in JS.
    // Supabase JS allows `.lt('current_period_end', new Date().toISOString())`
    
    const nowIso = new Date().toISOString()
    
    const { data: expiredTrials, error: fetchErr } = await supabase
      .from('tenant_subscriptions')
      .select('id, tenant_id')
      .eq('status', 'trialing')
      .lt('current_period_end', nowIso)

    if (fetchErr) {
      throw new Error(`Failed to fetch expired trials: ${fetchErr.message}`)
    }

    if (!expiredTrials || expiredTrials.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No expired trials found', 
        processed: 0 
      })
    }

    // 2. Transition them to suspended
    const expiredIds = expiredTrials.map(t => t.id)
    
    const { error: updateErr } = await supabase
      .from('tenant_subscriptions')
      .update({ status: 'suspended', updated_at: nowIso })
      .in('id', expiredIds)

    if (updateErr) {
      throw new Error(`Failed to update subscriptions: ${updateErr.message}`)
    }

    // Since audit.log_action() trigger fires on UPDATE, the database will automatically
    // log this transition against the service_role context.

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully expired trials', 
      processed: expiredIds.length,
      tenantIds: expiredTrials.map(t => t.tenant_id)
    })

  } catch (err: any) {
    console.error('[CRON] Trial Expiry Error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
