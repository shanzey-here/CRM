import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export type MrrResult = {
  mrr: number
  atRisk: number
  activeTenantCount: number
  pastDueTenantCount: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// The single MRR calculation in this app — imported by both the Analytics
// page's stat tiles and the snapshot-mrr cron, so the two can never drift
// apart. Computes MRR (active only — successfully-billing subscriptions,
// the real revenue figure) and "at risk" (past_due — payment retry in
// progress, not counted as MRR) together, from one query, since both need
// the exact same interval-normalization logic.
export async function computeMrr(supabase: SupabaseClient<Database>): Promise<MrrResult> {
  const { data, error } = await supabase
    .from('tenant_subscriptions')
    .select('tenant_id, status, saas_prices ( unit_amount, interval )')
    .in('status', ['active', 'past_due'])

  if (error) throw new Error(`Failed to compute MRR: ${error.message}`)

  let mrr = 0
  let atRisk = 0
  let activeTenantCount = 0
  let pastDueTenantCount = 0

  for (const row of data ?? []) {
    const price = row.saas_prices as { unit_amount: number | null; interval: string | null } | null
    if (!price?.unit_amount) continue

    // unit_amount is Stripe-style minor units (pence/cents); interval is
    // 'month' | 'year' — normalize annual plans to a monthly figure.
    const monthly = price.interval === 'year' ? price.unit_amount / 100 / 12 : price.unit_amount / 100

    if (row.status === 'active') {
      mrr += monthly
      activeTenantCount++
    } else if (row.status === 'past_due') {
      atRisk += monthly
      pastDueTenantCount++
    }
  }

  return { mrr: round2(mrr), atRisk: round2(atRisk), activeTenantCount, pastDueTenantCount }
}
