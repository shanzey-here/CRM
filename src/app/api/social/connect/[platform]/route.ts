import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateAggregatorProfileId } from '@/modules/social/server/repository'
import { getConnectUrl } from '@/modules/social/provider/zernio'

// Minimal connect mechanism — needed only to make this branch's own
// testing bar achievable (a real connected account to publish through).
// No settings page, no account list UI, no disconnect button — that's
// social-composer-ui's job.
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }

  // HARD GUARD: only tenant_admin can connect a social account — same
  // pattern as mailbox connection.
  if (user.app_metadata?.tenant_role !== 'tenant_admin') {
    return NextResponse.json({ error: 'Forbidden: only a tenant admin can connect a social account' }, { status: 403 })
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 })
  }

  const profileResult = await getOrCreateAggregatorProfileId(supabase, tenantId)
  if ('error' in profileResult) {
    console.error('[social connect start]', profileResult.error)
    return NextResponse.json({ error: 'Failed to resolve aggregator profile' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUrl = `${appUrl}/api/social/connect/${platform}/callback`

  const connectResult = await getConnectUrl(platform, profileResult.profileId, redirectUrl)
  if (!connectResult.ok) {
    console.error('[social connect start]', connectResult.error)
    return NextResponse.json({ error: connectResult.error }, { status: 500 })
  }

  return NextResponse.redirect(connectResult.authUrl)
}
