import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { AiQuotingModeInput } from '../schemas'

export async function getAiAssistantSettings(supabase: SupabaseClient<Database>, tenantId: string) {
  const { data, error } = await supabase
    .from('tenant_settings')
    .select('ai_quoting_mode')
    .eq('tenant_id', tenantId)
    .single()

  return { data, error }
}

export async function updateAiQuotingMode(supabase: SupabaseClient<Database>, tenantId: string, mode: AiQuotingModeInput) {
  const { data, error } = await supabase
    .from('tenant_settings')
    .update({ ai_quoting_mode: mode })
    .eq('tenant_id', tenantId)
    .select('ai_quoting_mode')
    .single()

  return { data, error }
}

export async function hasActiveMailbox(supabase: SupabaseClient<Database>, tenantId: string): Promise<boolean> {
  const { data } = await supabase
    .from('mailboxes')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1)

  return !!data && data.length > 0
}
