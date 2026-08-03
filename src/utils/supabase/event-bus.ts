import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Emits a domain event to the outbox table for reliable cross-module communication.
 *
 * @param supabase An authenticated Supabase client (Server or Client component)
 * @param eventType The specific event that occurred (e.g., 'lead.stage_changed')
 * @param sourceModule The domain module originating the event (e.g., 'crm', 'jobs')
 * @param payload The structured data related to the event
 * @param tenantId Optional explicit tenant override — only honored by
 *   emit_domain_event() for service_role callers (enforced in the RPC
 *   itself). Required for background workers with no user session to derive
 *   current_tenant_id() from, e.g. the mailbox sync worker processing many
 *   tenants' mailboxes in one run.
 * @returns The UUID of the newly inserted event
 */
export async function emitEvent(
  supabase: SupabaseClient,
  eventType: string,
  sourceModule: string,
  payload: Record<string, any> = {},
  tenantId?: string
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('emit_domain_event', {
    p_event_type: eventType,
    p_source_module: sourceModule,
    p_payload: payload,
    ...(tenantId ? { p_tenant_id: tenantId } : {}),
  })

  if (error) {
    console.error(`[Event Bus] Failed to emit event '${eventType}':`, error.message)
    return { data: null, error }
  }

  // Synchronously execute any matching automation workflows
  try {
    const { executeWorkflows } = await import('@/modules/workflows/server/engine')
    await executeWorkflows(
      supabase,
      eventType as any,
      payload,
      data as string,
      tenantId
    )
  } catch (engineErr) {
    // Top-level catch to absolutely guarantee workflows never break the core domain action
    console.error(`[Event Bus] Uncaught error triggering workflow engine for ${eventType}:`, engineErr)
  }

  // Synchronously execute notification generation
  try {
    const { generateNotifications } = await import('@/modules/notifications/server/generator')
    await generateNotifications(
      eventType,
      payload,
      data as string,
      tenantId
    )
  } catch (notifyErr) {
    // Top-level catch to absolutely guarantee notifications never break the core domain action
    console.error(`[Event Bus] Uncaught error triggering notification engine for ${eventType}:`, notifyErr)
  }

  return { data, error: null }
}
