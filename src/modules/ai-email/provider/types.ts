// Swappable LLM provider interface. Every caller (classify, draft, and
// anything added later) goes through this — no calling code ever imports a
// provider-specific SDK or references a model name directly. Swapping
// providers later means writing one new file implementing this interface
// and changing the one line in provider/index.ts that selects it.
export interface LlmAdapter {
  classify(input: ClassifyInput): Promise<ClassifyResult>
  draft(input: DraftInput): Promise<DraftResult>
}

export type ClassifyInput = {
  systemPrompt: string
  threadText: string
}

export type ClassifyResult = {
  needsQuote: boolean
  model: string
}

export type DraftInput = {
  systemPrompt: string
  threadText: string
  toneSamples: string[]
}

export type DraftResult = {
  bodyText: string
  model: string
}
