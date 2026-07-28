// Swappable LLM provider interface. Every caller (classify, draft, and
// anything added later) goes through this — no calling code ever imports a
// provider-specific SDK or references a model name directly. Swapping
// providers later means writing one new file implementing this interface
// and changing the one line in provider/index.ts that selects it.
export interface LlmAdapter {
  classify(input: ClassifyInput): Promise<ClassifyResult>
  draft(input: DraftInput): Promise<DraftResult>
  extract(input: ExtractInput): Promise<ExtractResult>
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

// A distinct step from classification — classify() only decides whether a
// quote is needed at all; extract() pulls whatever structured facts the
// thread actually contains toward computing one. Every string field is
// empty ('') rather than null/omitted when not determinable — the model
// must never fill a plausible-sounding guess into it, only report what's
// really there. catalogItemIds is the tenant's real inventory_items ids,
// passed in so the model can only ever select a real id, never invent one.
export type ExtractInput = {
  systemPrompt: string
  threadText: string
  catalog: { id: string; name: string; room: string | null }[]
}

export type ExtractedAddress = {
  line1: string
  city: string
  postcode: string
}

export type ExtractedItem = {
  inventoryItemId: string
  quantity: number
}

export type ExtractResult = {
  origin: ExtractedAddress
  destination: ExtractedAddress
  items: ExtractedItem[]
  model: string
}
