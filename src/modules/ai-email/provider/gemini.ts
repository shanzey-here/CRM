import { ClassifyInput, ClassifyResult, DraftInput, DraftResult, LlmAdapter } from './types'

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
  async classify({ systemPrompt, threadText }: ClassifyInput): Promise<ClassifyResult> {
    const response = await callGemini(CLASSIFY_MODEL, {
      systemInstruction: {
        parts: [
          {
            text: `${systemPrompt}\n\nYou are classifying a single email thread, not drafting a reply. Decide whether the customer's most recent message requires a priced quote (a specific price, cost estimate, or rate) to properly answer it. Routine scheduling confirmations, thank-yous, and general questions that don't ask about cost do NOT need a quote.`,
          },
        ],
      },
      contents: [{ role: 'user', parts: [{ text: threadText }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: { needs_quote: { type: 'boolean' } },
          required: ['needs_quote'],
        },
      },
    })

    const parsed = JSON.parse(extractText(response))
    if (typeof parsed.needs_quote !== 'boolean') throw new Error('Gemini classify response missing needs_quote')

    return { needsQuote: parsed.needs_quote, model: CLASSIFY_MODEL }
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
}

export function createGeminiAdapter(): LlmAdapter {
  return new GeminiAdapter()
}
