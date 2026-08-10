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

  // 4. Lookup Tenant
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id')
    .eq('public_widget_key', widgetKey)
    .single()

  if (tenantErr || !tenant) {
    return { error: 'Form unavailable.' }
  }

  // 5. Create Client (Single Funnel)
  // We force create a lead so the inquiry is tracked in the pipeline, and we hardcode the source.
  const corePayload = {
    ...data,
    source: 'web_widget'
  }

  // Passing undefined for userId since this is public, and forceCreateLead = true
  const result = await createClientCore(supabase, tenant.id, corePayload as any, undefined, true)

  if (!result.success) {
    console.error('Widget Submission Error:', result.error)
    return { error: 'Failed to submit request. Please try again.' }
  }

  return { success: true }
}
