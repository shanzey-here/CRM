// Swappable social-aggregator interface, mirroring the LlmAdapter pattern
// (src/modules/ai-email/provider/types.ts) exactly — every caller goes
// through this, no provider-specific code outside the concrete
// implementation file. publishPost() takes a single account, not a batch —
// per-account failure isolation (mailbox-sync-style) lives in the caller
// (publish.ts), which calls this once per account, even though the
// underlying provider could technically batch multiple targets in one
// request. Isolation is the point; batching would defeat it.
export interface SocialAggregatorAdapter {
  publishPost(input: PublishPostInput): Promise<PublishPostResult>
  getPostStatus(postId: string): Promise<PostStatusResult>
  getBasicAnalytics(accountId: string): Promise<AnalyticsResult>
}

export type PublishPostInput = {
  aggregatorProfileId: string // the tenant's Zernio profile id (tenant_settings.social_aggregator_profile_id)
  platform: string
  accountId: string // connected_social_accounts.aggregator_profile_id (the per-account id, despite the column's legacy name)
  content: string
  mediaUrls?: string[]
}

export type PublishPostResult =
  | { ok: true; postId: string; platformPostId: string; platformPostUrl: string | null }
  | { ok: false; error: string; brokenConnection: boolean }

export type PostStatusResult =
  | { ok: true; status: string; platformPostUrl: string | null; publishedAt: string | null }
  | { ok: false; error: string }

export type AnalyticsResult =
  | { ok: true; totalPosts: number; publishedPosts: number; followersCount: number | null }
  | { ok: false; error: string }
