'use server'

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { publicWidgetFormSchema, type PublicWidgetFormInput } from './schema'
import { createClientCore } from '@/app/office/clients/actions'
import { headers } from 'next/headers'

export async function publicCaptureAction(widgetKey: string, payload: PublicWidgetFormInput) {
  // 1. Silent Honeypot Check
  if (payload.website_url && payload.website_url.trim() !== '') {
    // If honeypot is filled, silently "succeed" without saving
    return { success: true }
  }

  // 2. Schema Validation
  const parseResult = publicWidgetFormSchema.safeParse(payload)
  if (!parseResult.success) {
    return { error: 'Validation failed.' }
  }

  const data = parseResult.data
  const supabase = createServiceRoleClient()
  
  // Try to get IP address for rate limiting
  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'

  // 3. Rate Limiting Check & Pruning (Service Role)
  // Prune expired rate limits first to avoid unbounded table growth
  await supabase
    .from('widget_rate_limits')
    .delete()
    .lt('expires_at', new Date().toISOString())

  // Check current count for this IP and widgetKey
  const { data: currentLimits, error: limitErr } = await supabase
    .from('widget_rate_limits')
    .select('id, count')
    .eq('ip_address', ipAddress)
    .eq('widget_key', widgetKey)
    .single()

  if (currentLimits) {
    if (currentLimits.count && currentLimits.count >= 5) { // max 5 per minute
      return { error: 'Too many requests. Please try again later.' }
    }
    // Increment
    await supabase
      .from('widget_rate_limits')
      .update({ count: (currentLimits.count || 0) + 1 })
      .eq('id', currentLimits.id)
  } else {
    // Insert new tracking row for this IP (expires in 1 minute)
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 1)
    
    await supabase
      .from('widget_rate_limits')
      .insert({
        ip_address: ipAddress,
        widget_key: widgetKey,
        count: 1,
        expires_at: expiresAt.toISOString()
      })
  }

  // 4. Lookup Brand — the widget key is per-brand now (was per-tenant), so
  // this single lookup resolves both which tenant owns the submission AND
  // which brand it should be tagged with, no separate tenant lookup needed.
  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('id, tenant_id')
    .eq('public_widget_key', widgetKey)
    .single()

  if (brandErr || !brand) {
    return { error: 'Form unavailable.' }
  }

  // 5. Create Client (Single Funnel)
  // We force create a lead so the inquiry is tracked in the pipeline, and we hardcode the source.
  const corePayload = {
    ...data,
    source: 'web_widget'
  }

  // Passing undefined for userId since this is public, and forceCreateLead = true.
  // brandId is explicit here (not resolved from a default) — a lead
  // captured through Brand A's snippet must be tagged Brand A, never
  // silently fall back to the tenant's default brand.
  const result = await createClientCore(supabase, brand.tenant_id, corePayload as any, undefined, true, brand.id)

  if (!result.success) {
    console.error('Widget Submission Error:', result.error)
    return { error: 'Failed to submit request. Please try again.' }
  }

  return { success: true }
}
