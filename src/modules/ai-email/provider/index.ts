import { LlmAdapter } from './types'
import { createGeminiAdapter } from './gemini'

// The one line that changes on a future provider swap — every caller
// (classify.ts, draft.ts, orchestrate.ts) goes through this factory, never
// imports a provider file directly.
export function getLlmAdapter(): LlmAdapter {
  return createGeminiAdapter()
}

export type { LlmAdapter, ClassifyInput, ClassifyResult, DraftInput, DraftResult } from './types'
