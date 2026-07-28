import { LlmAdapter } from '../provider/types'

export async function generateDraftReply(
  adapter: LlmAdapter,
  { systemPrompt, threadText, toneSamples }: { systemPrompt: string; threadText: string; toneSamples: string[] }
): Promise<{ bodyText: string; model: string }> {
  return adapter.draft({ systemPrompt, threadText, toneSamples })
}

// Pure string template — deliberately NOT an LLM call. This is the one path
// where a wrong price could slip into a customer-facing message, so it's
// structurally incapable of improvising a number: there's no model call to
// improvise with. Real quote generation belongs to ai-quoting-integration,
// built later on top of this branch's classification output.
export function buildHoldingReply({ companyName, recipientName }: { companyName: string; recipientName?: string }): string {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,'
  return [
    greeting,
    '',
    "Thanks for your interest — let me put together a proper quote and get back to you shortly.",
    '',
    `${companyName}`,
  ].join('\n')
}

// Same reasoning as buildHoldingReply — a fixed template, no LLM call, so
// there's no path by which a model could turn "ask for detail" into an
// invented guess. Used when extraction ran but came back incomplete:
// missingFields should name exactly what's missing (see
// extract.ts's missingFieldLabels()) so the customer knows precisely what
// to reply with, rather than a generic "we'll be in touch."
export function buildClarifyingReply({
  companyName,
  recipientName,
  missingFields,
}: {
  companyName: string
  recipientName?: string
  missingFields: string[]
}): string {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,'
  const askLine =
    missingFields.length > 0
      ? `To put together an accurate quote, could you let us know ${missingFields.join(' and ')}?`
      : 'To put together an accurate quote, could you send us a few more details about the move?'
  return [greeting, '', "Thanks for your interest!", '', askLine, '', `${companyName}`].join('\n')
}
