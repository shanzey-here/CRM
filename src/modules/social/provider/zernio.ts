import { AnalyticsResult, PostStatusResult, PublishPostInput, PublishPostResult, SocialAggregatorAdapter } from './types'

// Server-only — ZERNIO_API_KEY is never read outside this file, matching
// the same "server-only, never client-reachable" standard as
// GEMINI_API_KEY/GOOGLE_OAUTH_CLIENT_SECRET. One tenant-agnostic key for
// the whole app; tenant scoping happens via the profileId/accountId
// parameters passed on each call, not via per-tenant secrets — confirmed
// against the real live API (see provider/README notes in the plan):
// Zernio's hosted OAuth connect flow means this app never sees or stores
// a raw platform token, only Zernio's own opaque accountId.
const BASE_URL = 'https://zernio.com/api/v1'

function getApiKey(): string {
  const key = process.env.ZERNIO_API_KEY
  if (!key) throw new Error('ZERNIO_API_KEY is not set')
  return key
}

async function zernioFetch(path: string, options: RequestInit = {}): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  const text = await res.text()
  let data: any = null
  try {
    data = JSON.parse(text)
  } catch {
    // Non-JSON response (e.g. a 404 that falls through to Zernio's own
    // frontend app rather than a real API 404) — treat as an opaque error,
    // never crash the caller trying to parse it.
    data = { error: `Non-JSON response (status ${res.status})` }
  }
  return { status: res.status, data }
}

// Error strings/codes observed from the real live API that indicate the
// connection itself is broken (revoked/expired) rather than a transient or
// content-specific failure — confirmed empirically, not guessed, against a
// real deliberately-invalid accountId during verification testing.
function isBrokenConnectionError(status: number, data: any): boolean {
  const message = (data?.error || '').toLowerCase()
  return (
    status === 404 ||
    message.includes('not found') ||
    message.includes('reconnect') ||
    message.includes('expired') ||
    message.includes('invalid account')
  )
}

class ZernioAdapter implements SocialAggregatorAdapter {
  async publishPost({ aggregatorProfileId, platform, accountId, content, mediaUrls }: PublishPostInput): Promise<PublishPostResult> {
    const { status, data } = await zernioFetch('/posts', {
      method: 'POST',
      body: JSON.stringify({
        profileId: aggregatorProfileId,
        content,
        platforms: [{ platform, accountId }],
        publishNow: true,
        ...(mediaUrls && mediaUrls.length > 0 ? { mediaItems: mediaUrls.map((url) => ({ url })) } : {}),
      }),
    })

    if (status < 200 || status >= 300) {
      return { ok: false, error: data?.error || `Zernio API error (${status})`, brokenConnection: isBrokenConnectionError(status, data) }
    }

    const platformResult = data?.post?.platforms?.[0]
    if (!platformResult || platformResult.status !== 'published') {
      const err = platformResult?.error || data?.message || 'Post was not published (unexpected response shape)'
      return { ok: false, error: err, brokenConnection: isBrokenConnectionError(status, { error: err }) }
    }

    return {
      ok: true,
      postId: data.post._id,
      platformPostId: platformResult.platformPostId,
      platformPostUrl: platformResult.platformPostUrl ?? null,
    }
  }

  async getPostStatus(postId: string): Promise<PostStatusResult> {
    const { status, data } = await zernioFetch(`/posts/${postId}`)
    if (status < 200 || status >= 300) {
      return { ok: false, error: data?.error || `Zernio API error (${status})` }
    }
    const platformResult = data?.post?.platforms?.[0]
    return {
      ok: true,
      status: platformResult?.status ?? data?.post?.status ?? 'unknown',
      platformPostUrl: platformResult?.platformPostUrl ?? null,
      publishedAt: platformResult?.publishedAt ?? null,
    }
  }

  async getBasicAnalytics(accountId: string): Promise<AnalyticsResult> {
    const { status, data } = await zernioFetch(`/analytics?accountId=${accountId}`)
    if (status < 200 || status >= 300) {
      return { ok: false, error: data?.error || `Zernio API error (${status})` }
    }
    const account = (data?.accounts ?? []).find((a: any) => a._id === accountId)
    return {
      ok: true,
      totalPosts: data?.overview?.totalPosts ?? 0,
      publishedPosts: data?.overview?.publishedPosts ?? 0,
      followersCount: account?.followersCount ?? null,
    }
  }
}

// Creates a Zernio "profile" (the tenant-level container their API
// requires before any account can be connected) — not part of the adapter
// interface itself (it's a one-time-per-tenant provisioning step, not a
// publish/status/analytics capability), but lives in this file since it's
// the only place that talks to Zernio's REST API directly.
export async function createZernioProfile(name: string): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> {
  const { status, data } = await zernioFetch('/profiles', { method: 'POST', body: JSON.stringify({ name }) })
  if (status < 200 || status >= 300) {
    return { ok: false, error: data?.error || `Zernio API error (${status})` }
  }
  return { ok: true, profileId: data?.profile?._id }
}

// Generates the real hosted-OAuth authUrl for connecting a platform account
// under a given profile — confirmed against the live API, including the
// redirectUrl param needed to bring the user back to this app afterward
// (undocumented in Zernio's rendered docs; the query-param name that
// actually works, verified empirically).
export async function getConnectUrl(platform: string, profileId: string, redirectUrl: string): Promise<{ ok: true; authUrl: string } | { ok: false; error: string }> {
  const { status, data } = await zernioFetch(`/connect/${platform}?profileId=${profileId}&redirectUrl=${encodeURIComponent(redirectUrl)}`)
  if (status < 200 || status >= 300 || !data?.authUrl) {
    return { ok: false, error: data?.error || `Zernio API error (${status})` }
  }
  return { ok: true, authUrl: data.authUrl }
}

export function createZernioAdapter(): SocialAggregatorAdapter {
  return new ZernioAdapter()
}

export type ZernioConnectedAccount = {
  id: string
  platform: string
  displayName: string
  isActive: boolean
}

// The real working endpoint for listing a profile's connected accounts —
// the docs-suggested nested path /profiles/{id}/accounts 404s (falls
// through to Zernio's own frontend HTML, not a JSON error). Used by the
// connect callback to re-sync connected_social_accounts from the source
// of truth rather than parsing whatever query params Zernio's own hosted
// flow happens to append to the final redirect (never confirmed via a
// real click-through, so not relied on).
export async function listConnectedAccounts(profileId: string): Promise<{ ok: true; accounts: ZernioConnectedAccount[] } | { ok: false; error: string }> {
  const { status, data } = await zernioFetch(`/accounts?profileId=${profileId}`)
  if (status < 200 || status >= 300) {
    return { ok: false, error: data?.error || `Zernio API error (${status})` }
  }
  const accounts = (data?.accounts ?? []) as any[]
  return {
    ok: true,
    accounts: accounts.map((a) => ({
      id: a._id,
      platform: a.platform,
      displayName: a.displayName ?? a.username ?? a.platform,
      isActive: Boolean(a.isActive && a.enabled && a.platformStatus === 'active' && !a.needsReconnection),
    })),
  }
}
