import { SocialAggregatorAdapter } from './types'
import { createZernioAdapter } from './zernio'

// The one line that changes on a future provider swap — every caller goes
// through this factory, never imports provider/zernio.ts directly. Exact
// mirror of getLlmAdapter() (src/modules/ai-email/provider/index.ts).
export function getSocialAdapter(): SocialAggregatorAdapter {
  return createZernioAdapter()
}

export type { SocialAggregatorAdapter, PublishPostInput, PublishPostResult, PostStatusResult, AnalyticsResult } from './types'
