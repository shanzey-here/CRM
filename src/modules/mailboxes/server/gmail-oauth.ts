import { google } from 'googleapis'

// Minimum scopes for "read/send mail" — deliberately not gmail.modify or
// full-account scope. gmail.readonly covers sync; gmail.send is unused by
// this branch (no sending happens here) but requested now so ai-email-draft
// doesn't need a second consent round-trip for a scope this branch's UI
// already asked the user to grant.
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
]

function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth is not configured (GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI)')
  }

  // Test-only seam: lets scripts/test-imap/test-revoked-gmail-token.ts point
  // the token exchange at a local server that mimics Google's real
  // invalid_grant response, exercising the actual HTTP-and-error-parsing
  // pipeline rather than guessing which internal library method to stub.
  // Unset in every real environment — the library's real endpoint is used.
  const tokenUrlOverride = process.env.GOOGLE_OAUTH_TOKEN_URL_OVERRIDE
  if (tokenUrlOverride) {
    const { OAuth2Client } = require('google-auth-library')
    return new OAuth2Client({
      clientId,
      clientSecret,
      redirectUri,
      endpoints: { oauth2TokenUrl: tokenUrlOverride },
    })
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function getGmailAuthUrl(state: string) {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline', // required to receive a refresh token
    prompt: 'consent', // forces refresh_token on every connect, not just the first
    scope: GMAIL_SCOPES,
    state,
  })
}

export async function exchangeGmailCode(code: string) {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token — ensure access_type=offline and prompt=consent were used')
  }
  return { refreshToken: tokens.refresh_token }
}

// Mints a short-lived access token from the stored refresh token, on demand,
// at sync time. Never persisted. Detects the specific "access was revoked"
// case (Google returns invalid_grant) so the sync worker can route it
// through the same failure-isolation path with a clear, human-readable
// reason rather than an opaque exception.
export async function getGmailAccessToken(refreshToken: string): Promise<
  { accessToken: string } | { revoked: true; message: string } | { error: string }
> {
  const client = getOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })

  try {
    const { credentials } = await client.refreshAccessToken()
    if (!credentials.access_token) {
      return { error: 'Token refresh succeeded but returned no access_token' }
    }
    return { accessToken: credentials.access_token }
  } catch (err: any) {
    const googleError = err?.response?.data?.error
    if (googleError === 'invalid_grant') {
      return { revoked: true, message: 'Gmail access was revoked or expired — please reconnect this mailbox' }
    }
    return { error: err instanceof Error ? err.message : 'Failed to refresh Gmail access token' }
  }
}

export function getGmailClient(accessToken: string) {
  const client = getOAuthClient()
  client.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth: client })
}
