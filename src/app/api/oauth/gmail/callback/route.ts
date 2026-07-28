import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { exchangeGmailCode, getGmailAccessToken, getGmailClient } from '@/modules/mailboxes/server/gmail-oauth'
import { createOAuthMailbox } from '@/modules/mailboxes/server/repository'

function redirectToSettings(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/office/settings/mailboxes', request.url)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.app_metadata?.tenant_role !== 'tenant_admin') {
    return redirectToSettings(request, { error: 'forbidden' })
  }

  const tenantId = user.app_metadata?.tenant_id as string | undefined
  if (!tenantId) {
    return redirectToSettings(request, { error: 'no_tenant_context' })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = request.cookies.get('gmail_oauth_state')?.value

  if (!code) {
    return redirectToSettings(request, { error: 'missing_code' })
  }
  if (!state || !storedState || state !== storedState) {
    return redirectToSettings(request, { error: 'invalid_state' })
  }

  try {
    const { refreshToken } = await exchangeGmailCode(code)

    // Mint an access token from the refresh token to look up which address
    // was actually connected (for display + inbound/outbound detection at
    // sync time) — same on-demand minting the sync worker itself will do.
    const tokenResult = await getGmailAccessToken(refreshToken)
    if (!('accessToken' in tokenResult)) {
      return redirectToSettings(request, { error: 'profile_fetch_failed' })
    }
    const gmail = getGmailClient(tokenResult.accessToken)
    const profile = await gmail.users.getProfile({ userId: 'me' })
    const mailboxAddress = profile.data.emailAddress

    if (!mailboxAddress) {
      return redirectToSettings(request, { error: 'no_email_address' })
    }

    const serviceClient = createServiceRoleClient()
    const { error: insertError } = await createOAuthMailbox(serviceClient, tenantId, {
      provider: 'gmail',
      mailboxAddress,
      refreshToken,
    })

    if (insertError) {
      return redirectToSettings(request, { error: 'storage_failed' })
    }

    const response = redirectToSettings(request, { connected: mailboxAddress })
    response.cookies.delete('gmail_oauth_state')
    return response
  } catch (err) {
    console.error('[Gmail OAuth callback]', err)
    return redirectToSettings(request, { error: 'exchange_failed' })
  }
}
