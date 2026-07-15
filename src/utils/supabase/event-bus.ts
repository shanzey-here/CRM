import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Emits a domain event to the outbox table for reliable cross-module communication.
 * 
 * @param supabase An authenticated Supabase client (Server or Client component)
 * @param eventType The specific event that occurred (e.g., 'lead.stage_changed')
 * @param sourceModule The domain module originating the event (e.g., 'crm', 'jobs')
 * @param payload The structured data related to the event
 * @returns The UUID of the newly inserted event
 */
export async function emitEvent(
  supabase: SupabaseClient,
  eventType: string,
  sourceModule: string,
  payload: Record<string, any> = {}
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('emit_domain_event', {
    p_event_type: eventType,
    p_source_module: sourceModule,
    p_payload: payload,
  })

  if (error) {
    console.error(`[Event Bus] Failed to emit event '${eventType}':`, error.message)
    return { data: null, error }
  }

  return { data, error: null }
}
