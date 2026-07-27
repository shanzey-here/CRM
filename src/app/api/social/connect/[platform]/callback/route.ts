import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateAggregatorProfileId, syncConnectedAccountsFromAggregator } from '@/modules/social/server/repository'

function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/office/settings', request.url)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return NextResponse.redirect(url)
}

// No code/token to exchange here and no CSRF-state cookie to verify:
// Zernio's hosted OAuth flow never hands this app anything sensitive on
// the way back (confirmed empirically — see provider/zernio.ts), and the
// exact query params it appends to the final redirect were never
// confirmed via a real click-through. Instead this route re-syncs
// connected_social_accounts from Zernio's own account-list API (the
// source of truth) for the tenant's already-known profileId — an
// idempotent operation gated only by the authenticated tenant_admin
// session, so a forged/replayed hit on this URL can't do anything beyond
// re-reading the tenant's own already-true connection state.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.tenant_role !== 'tenant_admin') {
    return redirectToSettings(request, { error: 'forbidden' })
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return redirectToSettings(request, { error: 'no_tenant_context' })
  }

  const profileResult = await getOrCreateAggregatorProfileId(supabase, tenantId)
  if ('error' in profileResult) {
    console.error('[social connect callback]', profileResult.error)
    return redirectToSettings(request, { error: 'profile_lookup_failed' })
  }

  const syncResult = await syncConnectedAccountsFromAggregator(supabase, tenantId, profileResult.profileId)
  if (!syncResult.ok) {
    console.error('[social connect callback]', syncResult.error)
    return redirectToSettings(request, { error: 'sync_failed' })
  }

  return redirectToSettings(request, { social_connected: String(syncResult.count) })
}
