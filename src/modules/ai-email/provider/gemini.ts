import { ClassifyInput, ClassifyResult, DraftInput, DraftResult, ExtractInput, ExtractResult, LlmAdapter } from './types'

// Server-only — GEMINI_API_KEY is never read outside this file, matching
// the same "server-only, never client-reachable" standard as
// GOOGLE_OAUTH_CLIENT_SECRET (src/modules/mailboxes/server/gmail-oauth.ts).
// This file must never be imported from a 'use client' component.
// gemini-2.5-flash/-flash-lite are both listed by ListModels but rejected
// at generateContent time with "no longer available to new users" — a
// project/account-level restriction on this API key, confirmed via a real
// 404 (not an auth failure) and cross-checked against the actual model
// list this key can call. Using the '-latest' aliases instead — Google's
// own floating pointer to the current recommended model — avoids repeating
// this exact staleness problem as the lineup moves on. Swapping either is
// a one-line change here; nothing upstream depends on the model string.
const CLASSIFY_MODEL = 'gemini-flash-lite-latest'
const DRAFT_MODEL = 'gemini-flash-latest'
const EXTRACT_MODEL = 'gemini-flash-lite-latest'

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')
  return key
}

async function callGemini(model: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getApiKey()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini API error (${res.status}): ${text || res.statusText}`)
  }

  return res.json()
}

function extractText(response: any): string {
  const text = response?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') throw new Error('Gemini response had no text content')
  return text
}

class GeminiAdapter implements LlmAdapter {
  async classify({ systemPrompt, threadText, defaultLabels }: ClassifyInput): Promise<ClassifyResult> {
    // Same call as before — label suggestion piggybacks on this one request
    // rather than adding a second Gemini round-trip per email.
    const labelBlock =
      defaultLabels.length > 0
        ? `\n\nAlso decide which of these labels (if any) apply to this thread. Select ONLY from this exact list, using the name exactly as written (never invent a label name not in this list, and return an empty list if none clearly apply):\n${defaultLabels.map((l) => `- ${l.name}`).join('\n')}`
        : ''

    const response = await callGemini(CLASSIFY_MODEL, {
      systemInstruction: {
        parts: [
          {
            text: `${systemPrompt}\n\nYou are classifying a single email thread, not drafting a reply. Decide whether the customer's most recent message requires a priced quote (a specific price, cost estimate, or rate) to properly answer it. Routine scheduling confirmations, thank-yous, and general questions that don't ask about cost do NOT need a quote.${labelBlock}`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: threadText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            needs_quote: { type: 'boolean' },
            label_names: { type: 'array', items: { type: 'string' } },
          },
          required: ['needs_quote', 'label_names'],
        },
      },
    })

    const parsed = JSON.parse(extractText(response))
    if (typeof parsed.needs_quote !== 'boolean') throw new Error('Gemini classify response missing needs_quote')

    // Defensive: never trust a label name the model returned if it isn't
    // genuinely in the closed list we gave it — discard, don't guess-repair.
    // Mirrors extract()'s catalogIds filtering below.
    const nameToId = new Map(defaultLabels.map((l) => [l.name.toLowerCase(), l.id]))
    const suggestedLabelIds: string[] = Array.isArray(parsed.label_names)
      ? parsed.label_names
          .filter((n: unknown): n is string => typeof n === 'string' && nameToId.has(n.toLowerCase()))
          .map((n: string) => nameToId.get(n.toLowerCase())!)
      : []

    return { needsQuote: parsed.needs_quote, model: CLASSIFY_MODEL, suggestedLabelIds }
  }

  async draft({ systemPrompt, threadText, toneSamples }: DraftInput): Promise<DraftResult> {
    const toneBlock =
      toneSamples.length > 0
        ? `\n\nHere are some real examples of how this company's staff have written to customers in the past. Match this tone and style:\n${toneSamples.map((s, i) => `Example ${i + 1}:\n${s}`).join('\n\n')}`
        : ''

    const response = await callGemini(DRAFT_MODEL, {
      systemInstruction: { parts: [{ text: `${systemPrompt}${toneBlock}` }] },
      contents: [
        {
          role: 'user',
          parts: [{ text: `Here is the email thread so far. Write a reply to the customer's most recent message.\n\n${threadText}` }],
        },
      ],
    })

    const bodyText = extractText(response).trim()
    return { bodyText, model: DRAFT_MODEL }
  }

  async extract({ systemPrompt, threadText, catalog }: ExtractInput): Promise<ExtractResult> {
    const catalogBlock = catalog.length > 0
      ? catalog.map((c) => `- id: ${c.id} | name: ${c.name}${c.room ? ` | room: ${c.room}` : ''}`).join('\n')
      : '(no inventory catalog items are configured for this tenant)'

    const response = await callGemini(EXTRACT_MODEL, {
      systemInstruction: {
        parts: [
          {
            text: [
              systemPrompt,
              '',
              'You are extracting structured facts from this email thread — NOT drafting a reply, NOT deciding whether a quote is needed (that has already been decided). Extract ONLY what is actually stated or unambiguously implied in the thread. Never fill in a plausible-sounding guess.',
              '',
              'For each address field (line1, city, postcode) that is not clearly present in the thread, return an empty string "" — never invent a street, city, or postcode that was not actually mentioned.',
              '',
              `For items, select ONLY from this exact catalog of real inventory items (never invent an id or name not in this list):\n${catalogBlock}`,
              '',
              'If no items are clearly mentioned or implied, return an empty items array. Only include an item if the thread genuinely mentions it or something equivalent (e.g. "2-bed flat" does NOT by itself justify guessing specific furniture — only include items actually named).',
            ].join('\n'),
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: threadText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            origin_line_1: { type: 'string' },
            origin_city: { type: 'string' },
            origin_postcode: { type: 'string' },
            destination_line_1: { type: 'string' },
            destination_city: { type: 'string' },
            destination_postcode: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  inventory_item_id: { type: 'string' },
                  quantity: { type: 'integer' },
                },
                required: ['inventory_item_id', 'quantity'],
              },
            },
          },
          required: [
            'origin_line_1', 'origin_city', 'origin_postcode',
            'destination_line_1', 'destination_city', 'destination_postcode',
            'items',
          ],
        },
      },
    })

    const parsed = JSON.parse(extractText(response))

    // Defensive: never trust an item id the model returned if it isn't
    // genuinely in the catalog we gave it — discard, don't guess-repair.
    const catalogIds = new Set(catalog.map((c) => c.id))
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((i: any) => typeof i?.inventory_item_id === 'string' && catalogIds.has(i.inventory_item_id) && Number(i.quantity) > 0)
          .map((i: any) => ({ inventoryItemId: i.inventory_item_id, quantity: Math.round(Number(i.quantity)) }))
      : []

    return {
      origin: {
        line1: String(parsed.origin_line_1 ?? ''),
        city: String(parsed.origin_city ?? ''),
        postcode: String(parsed.origin_postcode ?? ''),
      },
      destination: {
        line1: String(parsed.destination_line_1 ?? ''),
        city: String(parsed.destination_city ?? ''),
        postcode: String(parsed.destination_postcode ?? ''),
      },
      items,
      model: EXTRACT_MODEL,
    }
  }
}

export function createGeminiAdapter(): LlmAdapter {
  return new GeminiAdapter()
}
