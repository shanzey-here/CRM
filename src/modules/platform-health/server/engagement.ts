import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

export type TenantEngagement = {
  tenantId: string
  tenantName: string
  lastSignInAt: string | null
}

export type EngagementResult = {
  activeWindowDays: number
  activeTenantCount: number
  totalTenantCount: number
  // Quietest-first (never signed in, then oldest last sign-in) — the order
  // that actually helps a super admin spot tenants who've gone quiet.
  tenants: TenantEngagement[]
}

const ACTIVE_WINDOW_DAYS = 7

// Real, direct signal — Supabase Auth's own last_sign_in_at, confirmed via a
// real query to have genuine data (47/69 real users). No new instrumentation
// needed. Requires the Auth Admin API (service_role only).
//
// READ-ONLY: adminClient.auth.admin also exposes createUser/updateUserById/
// deleteUser — this feature has no legitimate reason to touch any of those.
// The only call this function makes is listUsers(). Do not add a write call
// here without re-examining whether it belongs in this feature at all.
export async function getTenantEngagement(
  adminClient: SupabaseClient<Database>,
  tenants: { id: string; name: string }[]
): Promise<EngagementResult> {
  const allUsers: { app_metadata: Record<string, unknown>; last_sign_in_at?: string }[] = []
  let page = 1
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`Failed to list users for engagement: ${error.message}`)
    allUsers.push(...data.users)
    if (data.users.length < 200) break
    page++
  }

  const lastSignInByTenant = new Map<string, string>()
  for (const u of allUsers) {
    const tenantId = u.app_metadata?.tenant_id as string | undefined
    if (!tenantId || !u.last_sign_in_at) continue
    const existing = lastSignInByTenant.get(tenantId)
    if (!existing || u.last_sign_in_at > existing) lastSignInByTenant.set(tenantId, u.last_sign_in_at)
  }

  const cutoffMs = Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000

  const tenantEngagement: TenantEngagement[] = tenants.map((t) => ({
    tenantId: t.id,
    tenantName: t.name,
    lastSignInAt: lastSignInByTenant.get(t.id) ?? null,
  }))

  const activeTenantCount = tenantEngagement.filter(
    (t) => t.lastSignInAt !== null && new Date(t.lastSignInAt).getTime() >= cutoffMs
  ).length

  const sorted = [...tenantEngagement].sort((a, b) => {
    if (a.lastSignInAt === null && b.lastSignInAt === null) return 0
    if (a.lastSignInAt === null) return -1
    if (b.lastSignInAt === null) return 1
    return new Date(a.lastSignInAt).getTime() - new Date(b.lastSignInAt).getTime()
  })

  return {
    activeWindowDays: ACTIVE_WINDOW_DAYS,
    activeTenantCount,
    totalTenantCount: tenants.length,
    tenants: sorted,
  }
}
