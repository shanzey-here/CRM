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
  // The tenant's real default (is_default = true) email labels, passed in so
  // the model can only ever suggest a label that actually exists — never
  // invent one, and never suggest a tenant's custom label (out of scope for
  // v1, see suggestedLabelIds below). Empty array is valid (no default
  // labels configured, or none apply) and simply yields no suggestions.
  defaultLabels: { id: string; name: string }[]
}

export type ClassifyResult = {
  needsQuote: boolean
  model: string
  // Real email_labels.id values, filtered server-side against defaultLabels
  // — never trust an id/name the model returns that isn't genuinely in the
  // closed list it was given, same defensive pattern as extract()'s catalog
  // handling below.
  suggestedLabelIds: string[]
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
