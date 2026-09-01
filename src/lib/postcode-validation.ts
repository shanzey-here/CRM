/**
 * Shared UK Postcode Validation Utility
 *
 * Backed by:
 * 1. Fast regex format check (UK Government / BS 7666 standard).
 * 2. Real-time existence validation via postcodes.io (ONS UK Postcode Directory).
 * 3. Graceful degradation: If postcodes.io is unreachable or times out,
 *    falls back to format validation with a non-blocking warning rather
 *    than halting business operations.
 */

import { z } from 'zod'

export const UK_POSTCODE_REGEX =
  /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i

/**
 * Normalizes a UK postcode to standard uppercase format with proper spacing (e.g. "sw1a1aa" -> "SW1A 1AA").
 */
export function normalizeUkPostcode(raw: string): string {
  const clean = raw.trim().toUpperCase().replace(/\s+/g, '')
  if (clean.length < 5) return raw.trim().toUpperCase()
  const outward = clean.slice(0, clean.length - 3)
  const inward = clean.slice(clean.length - 3)
  return `${outward} ${inward}`
}

/**
 * Fast synchronous check for standard UK postcode format.
 */
export function isValidUkPostcodeFormat(raw?: string | null): boolean {
  if (!raw || typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (trimmed.length === 0) return false
  return UK_POSTCODE_REGEX.test(trimmed)
}

export interface PostcodeValidationResult {
  valid: boolean
  error?: string
  normalized?: string
  degraded?: boolean
}

/**
 * Authoritative UK Postcode Validator.
 *
 * 1. Checks format via regex ("Not a valid UK postcode format").
 * 2. Checks existence via postcodes.io ("This postcode doesn't exist").
 * 3. Gracefully degrades to regex check if postcodes.io is down/unreachable.
 */
export async function validateUkPostcode(
  raw?: string | null,
  options?: { timeoutMs?: number; fetchFn?: typeof fetch }
): Promise<PostcodeValidationResult> {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return { valid: false, error: 'Postcode is required' }
  }

  const trimmed = raw.trim()

  // 1. Fast regex format check
  if (!isValidUkPostcodeFormat(trimmed)) {
    return { valid: false, error: 'Not a valid UK postcode format' }
  }

  const normalized = normalizeUkPostcode(trimmed)
  const queryCode = normalized.replace(/\s+/g, '')
  const timeoutMs = options?.timeoutMs ?? 6000
  const fetchImpl = options?.fetchFn ?? fetch

  // 2. Live verification against postcodes.io
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetchImpl(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(queryCode)}/validate`,
      {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      }
    )

    clearTimeout(timer)

    if (response.ok) {
      const data = await response.json()
      if (data && typeof data.result === 'boolean') {
        if (data.result === true) {
          return { valid: true, normalized }
        } else {
          return { valid: false, error: "This postcode doesn't exist", normalized }
        }
      }
    }

    // If postcodes.io returned a 404 or unexpected 4xx/5xx status
    if (response.status === 404) {
      return { valid: false, error: "This postcode doesn't exist", normalized }
    }

    // Non-OK status other than 404: degrade gracefully
    console.warn(
      `[Postcode Validation] postcodes.io returned status ${response.status}. Gracefully degrading to format check for "${normalized}".`
    )
    return { valid: true, normalized, degraded: true }
  } catch (err: any) {
    // Network error, DNS failure, or timeout abort: graceful degradation
    console.warn(
      `[Postcode Validation] postcodes.io unreachable (${err?.message || 'timeout'}). Gracefully degrading to format check for "${normalized}".`
    )
    return { valid: true, normalized, degraded: true }
  }
}

/**
 * Zod schema helpers for instant synchronous format validation in forms.
 */
export const ukPostcodeSchema = z
  .string()
  .trim()
  .min(1, 'Postcode is required')
  .refine(isValidUkPostcodeFormat, { message: 'Not a valid UK postcode format' })

export const optionalUkPostcodeSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (!val || val === '') return true
      return isValidUkPostcodeFormat(val)
    },
    { message: 'Not a valid UK postcode format' }
  )
