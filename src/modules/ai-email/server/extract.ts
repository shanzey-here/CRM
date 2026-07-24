import { LlmAdapter, ExtractResult, ExtractedAddress } from '../provider/types'

export type CatalogEntry = { id: string; name: string; room: string | null; default_volume: number }

export async function extractQuoteDetails(
  adapter: LlmAdapter,
  { systemPrompt, threadText, catalog }: { systemPrompt: string; threadText: string; catalog: CatalogEntry[] }
): Promise<ExtractResult> {
  return adapter.extract({
    systemPrompt,
    threadText,
    catalog: catalog.map((c) => ({ id: c.id, name: c.name, room: c.room })),
  })
}

function isAddressComplete(addr: ExtractedAddress): boolean {
  return addr.line1.trim().length > 0 && addr.city.trim().length > 0 && addr.postcode.trim().length > 0
}

// The completeness threshold, stated exactly per the plan: ready to compute
// a real quote iff origin AND destination are both complete addresses
// (matching addresses' own NOT NULL columns exactly) AND at least one real
// catalog item was matched. Missing any one of the three means "ask, don't
// guess" — deliberately strict, since a first inquiry email commonly lacks
// this, and that's the expected case, not an edge case.
export function isExtractionComplete(result: ExtractResult): boolean {
  return isAddressComplete(result.origin) && isAddressComplete(result.destination) && result.items.length > 0
}

export function missingFieldLabels(result: ExtractResult): string[] {
  const missing: string[] = []
  if (!isAddressComplete(result.origin)) missing.push('the full collection address (including postcode)')
  if (!isAddressComplete(result.destination)) missing.push('the full delivery address (including postcode)')
  if (result.items.length === 0) missing.push('roughly what needs moving')
  return missing
}
