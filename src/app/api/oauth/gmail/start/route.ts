import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getGmailAuthUrl } from '@/modules/mailboxes/server/gmail-oauth'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }

  // HARD GUARD: only tenant_admin can connect a mailbox — same pattern as
  // every other tenant_admin-only action in this codebase.
  if (user.app_metadata?.tenant_role !== 'tenant_admin') {
    return NextResponse.json({ error: 'Forbidden: only a tenant admin can connect a mailbox' }, { status: 403 })
  }

  const state = randomBytes(16).toString('hex')

  let authUrl: string
  try {
    authUrl = getGmailAuthUrl(state)
  } catch (err) {
    console.error('[Gmail OAuth start]', err)
    return NextResponse.json({ error: 'Gmail connection is not configured on this environment' }, { status: 500 })
  }

  const response = NextResponse.redirect(authUrl)
  // Short-lived CSRF nonce, verified in the callback — not tenant-encoding:
  // the callback re-derives tenant/role from the session the same way every
  // other authenticated route does, since it's the same browser session.
  response.cookies.set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })

  // Which brand this connection should be tagged with — carried across the
  // Google redirect the same way the CSRF state nonce is (a short-lived
  // cookie, not the OAuth state param itself). Absent when the tenant has
  // only one brand; the callback falls back to the default brand then.
  const brandId = new URL(request.url).searchParams.get('brand')
  if (brandId) {
    response.cookies.set('gmail_oauth_brand_id', brandId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600,
      path: '/',
    })
  }

  return response
}
